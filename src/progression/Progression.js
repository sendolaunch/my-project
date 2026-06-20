import { XP, NODES, NODE_BY_ID, SKILL_MOD_KIND } from './skillTree.js';

// The player's character progression (§5): level, XP, and spent skill points.
// Pure meta-progression — persists across runs via localStorage like the stash,
// and like the stash it's NOT tradeable, so it carries no economic risk. Emits
// the same shape of modifier block the gear system does, so the two just add up.

const STORAGE_KEY = 'ossara.progress.v1';

export class Progression {
  constructor() {
    this.level = 1;
    this.xp = 0;                 // XP into the current level
    this.unspent = 0;            // skill points available to spend
    this.ranks = {};             // nodeId → rank
    this._listeners = [];
    this._modsCache = null;
    this.load();
  }

  onChange(fn) { this._listeners.push(fn); }
  _notify() { this._modsCache = null; this.save(); for (const fn of this._listeners) fn(); }

  xpToNext() { return XP.toNext(this.level); }

  /** Award XP, leveling up (possibly several times). Returns levels gained. */
  addXp(amount) {
    if (this.level >= XP.maxLevel) return 0;
    this.xp += amount;
    let gained = 0;
    while (this.level < XP.maxLevel && this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level++;
      this.unspent += XP.pointsPerLevel;
      gained++;
    }
    if (this.level >= XP.maxLevel) this.xp = 0;
    this._notify();
    return gained;
  }

  rankOf(nodeId) { return this.ranks[nodeId] || 0; }

  /** A node is unlocked once the node above it in its branch has ≥1 rank. */
  isUnlocked(nodeId) {
    const node = NODE_BY_ID[nodeId];
    return !node.prereq || this.rankOf(node.prereq) >= 1;
  }

  canRank(nodeId) {
    const node = NODE_BY_ID[nodeId];
    return this.unspent > 0 && this.isUnlocked(nodeId) && this.rankOf(nodeId) < node.maxRank;
  }

  rank(nodeId) {
    if (!this.canRank(nodeId)) return false;
    this.ranks[nodeId] = this.rankOf(nodeId) + 1;
    this.unspent--;
    this._notify();
    return true;
  }

  spentPoints() { return Object.values(this.ranks).reduce((s, r) => s + r, 0); }

  /** Refund every spent point (free QoL for now; a Gold cost can gate it later). */
  respec() {
    this.unspent += this.spentPoints();
    this.ranks = {};
    this._notify();
  }

  /** Aggregate ranked nodes into a modifier block (cached until ranks change). */
  getModifiers() {
    if (this._modsCache) return this._modsCache;
    const mods = {};
    for (const node of NODES) {
      const r = this.rankOf(node.id);
      if (r > 0) mods[node.mod] = (mods[node.mod] || 0) + node.per * r;
    }
    this._modsCache = mods;
    return mods;
  }

  // Convenience for systems that need a single flat value with a default.
  mod(key) { return this.getModifiers()[key] || 0; }

  modKind(key) { return SKILL_MOD_KIND[key]; }

  // ── Persistence (guarded for headless tests) ─────────────────────────────────
  save() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        level: this.level, xp: this.xp, unspent: this.unspent, ranks: this.ranks,
      }));
    } catch { /* non-fatal */ }
  }

  load() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      this.level = d.level || 1;
      this.xp = d.xp || 0;
      this.unspent = d.unspent || 0;
      this.ranks = d.ranks || {};
    } catch { /* corrupt save — start fresh */ }
  }
}
