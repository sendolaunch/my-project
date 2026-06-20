import { PALETTE, RARITY_COLOR } from '../config/palette.js';

// The skill tree (§5), as pure data. Four branches — Tower specialist, Hero
// combat, Support, Economy — exactly the doc's split. Points come from leveling;
// spending them ranks nodes whose effects aggregate into a modifier block that
// stacks additively with gear (§4). "Not tradeable, no economic risk — pure
// progression that defines your co-op role" (§5).
//
// Each branch is a short vertical chain: a node unlocks once the one above it has
// at least one rank. Effects use the same canonical modifier keys the gameplay
// reads, so a skill point and a gear perk speak the same language.

export const XP = {
  // Cumulative-per-level curve. Tuned so a first full clear (~1,000 XP) lands the
  // player around level 6–7 — a quick taste — with a long tail to fully spec.
  toNext: (level) => Math.floor(40 * Math.pow(level, 1.5)),
  pointsPerLevel: 1,
  maxLevel: 60,
};

export const BRANCHES = [
  { id: 'tower',   label: 'Tower Specialist', tag: 'Defenses hit harder',      color: PALETTE.rotGreen },
  { id: 'hero',    label: 'Hero Combat',      tag: 'You are the damage',       color: PALETTE.plagueGreen },
  { id: 'support', label: 'Support',          tag: 'Endurance & buffs (co-op)', color: PALETTE.bone },
  { id: 'economy', label: 'Economy',          tag: 'Better drops, more Gold',  color: RARITY_COLOR.mythic },
];

// NODES: one canonical modifier key per node, applied per rank. `prereq` is the
// node directly above in its branch (null for the entry node).
export const NODES = [
  // ── Tower Specialist ──
  { id: 'reinforced', branch: 'tower', name: 'Reinforced Stakes', mod: 'towerDamage',      per: 0.07, maxRank: 5, prereq: null,         desc: '+7% tower damage per rank' },
  { id: 'fareyes',    branch: 'tower', name: 'Far-eyes',          mod: 'towerRange',       per: 0.08, maxRank: 4, prereq: 'reinforced', desc: '+8% tower range per rank' },
  { id: 'cadence',    branch: 'tower', name: 'Rapid Cadence',     mod: 'towerAttackSpeed', per: 0.06, maxRank: 4, prereq: 'fareyes',    desc: '+6% tower attack speed per rank' },

  // ── Hero Combat ──
  { id: 'might',   branch: 'hero', name: "Warden's Might", mod: 'heroDamage',  per: 0.06, maxRank: 5, prereq: null,    desc: '+6% hero damage per rank' },
  { id: 'keen',    branch: 'hero', name: 'Keen Strikes',   mod: 'critChance',  per: 0.03, maxRank: 4, prereq: 'might', desc: '+3% crit chance per rank' },
  { id: 'fury',    branch: 'hero', name: 'Battle Fury',    mod: 'attackSpeed', per: 0.05, maxRank: 4, prereq: 'keen',  desc: '+5% hero attack speed per rank' },

  // ── Support ──
  { id: 'hardened', branch: 'support', name: 'Hardened Flesh', mod: 'heroMaxHp', per: 0.12, maxRank: 5, prereq: null,       desc: '+12% max HP per rank' },
  { id: 'windward', branch: 'support', name: 'Second Wind',    mod: 'heroRegen', per: 3,    maxRank: 4, prereq: 'hardened', desc: '+3 HP/sec regen per rank' },
  { id: 'mending',  branch: 'support', name: 'Ward Mending',   mod: 'wardRegen', per: 0.15, maxRank: 4, prereq: 'windward', desc: '+0.15 ward/sec mended per rank' },

  // ── Economy ──
  { id: 'plunder', branch: 'economy', name: 'Plunder',     mod: 'goldFind',     per: 0.10, maxRank: 5, prereq: null,      desc: '+10% Gold from kills per rank' },
  { id: 'graveluck', branch: 'economy', name: 'Grave-luck', mod: 'magicFind',   per: 0.08, maxRank: 4, prereq: 'plunder', desc: '+8% drop luck per rank' },
  { id: 'warchest', branch: 'economy', name: 'War Chest',  mod: 'startingGold', per: 40,   maxRank: 3, prereq: 'graveluck', desc: '+40 starting Gold per rank' },
];

export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
export const NODES_BY_BRANCH = Object.fromEntries(
  BRANCHES.map((b) => [b.id, NODES.filter((n) => n.branch === b.id)])
);

// How each modifier is read by gameplay — `percent` keys are fractions applied
// multiplicatively at the use site; `flat` keys are added directly.
export const SKILL_MOD_KIND = {
  towerDamage: 'percent', towerRange: 'percent', towerAttackSpeed: 'percent',
  heroDamage: 'percent', critChance: 'percent', attackSpeed: 'percent',
  heroMaxHp: 'percent', heroRegen: 'flat', wardRegen: 'flat',
  goldFind: 'percent', magicFind: 'percent', startingGold: 'flat',
};
