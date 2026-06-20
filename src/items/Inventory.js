import { SLOTS, MODIFIERS } from './itemDefs.js';

// Owns the player's gear: everything collected, plus which item fills each of the
// nine equip slots. Aggregates equipped perks into a flat modifier block the
// gameplay reads. Persists to localStorage so loot is meta-progression that
// survives across defense runs (the §4 "infinite grind" only matters if it sticks).

const STORAGE_KEY = 'ossara.stash.v1';

function emptyMods() {
  const m = {};
  for (const key of Object.keys(MODIFIERS)) if (key !== 'cosmetic') m[key] = 0;
  m.cosmeticCount = 0;
  return m;
}

export class Inventory {
  constructor() {
    this.items = new Map();                 // id → item
    this.equipped = {};                     // slot → item id | null
    for (const s of SLOTS) this.equipped[s] = null;
    this._listeners = [];
    this._modsCache = null;
    this.load();
  }

  onChange(fn) { this._listeners.push(fn); }
  _notify() { this._modsCache = null; this.save(); for (const fn of this._listeners) fn(); }

  add(item) {
    this.items.set(item.id, item);
    this._notify();
    return item;
  }

  get(id) { return this.items.get(id); }

  /** Items not currently equipped, newest first. */
  backpack() {
    const equippedIds = new Set(Object.values(this.equipped).filter(Boolean));
    return [...this.items.values()].filter((i) => !equippedIds.has(i.id)).reverse();
  }

  equippedItems() {
    const out = {};
    for (const s of SLOTS) out[s] = this.equipped[s] ? this.items.get(this.equipped[s]) : null;
    return out;
  }

  equip(id) {
    const item = this.items.get(id);
    if (!item) return;
    this.equipped[item.slot] = id;          // any prior item simply returns to the backpack
    this._notify();
  }

  unequip(slot) {
    if (!this.equipped[slot]) return;
    this.equipped[slot] = null;
    this._notify();
  }

  /** Permanently destroy an item (future salvage sink §6.5 will route through here). */
  discard(id) {
    const item = this.items.get(id);
    if (!item) return;
    if (this.equipped[item.slot] === id) this.equipped[item.slot] = null;
    this.items.delete(id);
    this._notify();
  }

  /**
   * Aggregate equipped perks into fractional multipliers the gameplay applies.
   * e.g. a +12% Power perk contributes 0.12 to mods.heroDamage. Cached until the
   * loadout changes, so hot-loop reads are free.
   */
  getModifiers() {
    if (this._modsCache) return this._modsCache;
    const mods = emptyMods();
    for (const s of SLOTS) {
      const item = this.equipped[s] ? this.items.get(this.equipped[s]) : null;
      if (!item) continue;
      for (const p of item.perks) {
        if (p.cosmetic) { mods.cosmeticCount++; continue; }
        if (mods[p.mod] !== undefined) mods[p.mod] += p.value / 100;
      }
    }
    this._modsCache = mods;
    return mods;
  }

  // ── Persistence (guarded — localStorage is absent in headless tests) ─────────
  save() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items: [...this.items.values()],
        equipped: this.equipped,
      }));
    } catch { /* private mode / quota — non-fatal, loot just won't persist */ }
  }

  load() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const item of data.items || []) this.items.set(item.id, item);
      for (const s of SLOTS) this.equipped[s] = (data.equipped && data.equipped[s]) || null;
    } catch { /* corrupt save — start fresh rather than crash */ }
  }

  count() { return this.items.size; }
}
