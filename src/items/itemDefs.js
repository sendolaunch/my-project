import { RARITY_COLOR } from '../config/palette.js';

// ── The gear system, as pure data (§4: "all data, not art; build it deep and
// early — the look comes from asset packs later"). Nothing here imports Three.js.
//
// Three stacked layers per item, exactly as the doc lays them out:
//   1. RARITY   — sets how many perks roll and how hard they roll (RARITIES).
//   2. PERKS    — which rolled abilities the item has (PERKS, filtered by slot).
//   3. STAT ROLL— each perk's magnitude rolls in a range, so two identical
//                 legendaries differ. "God rolls" are the forever-grind (§4).

// The nine equip slots (§4). `weaponKinds` flavors the weapon slot (sword/bow/
// staff per §4) — purely cosmetic naming for now; mechanics come from perks.
export const SLOTS = ['head', 'chest', 'legs', 'feet', 'hands', 'cape', 'pet', 'weapon', 'accessory'];

export const SLOT_NOUNS = {
  head:      ['Helm', 'Hood', 'Visor'],
  chest:     ['Cuirass', 'Plate', 'Shroud'],
  legs:      ['Greaves', 'Faulds', 'Legguards'],
  feet:      ['Boots', 'Treads', 'Sabatons'],
  hands:     ['Gauntlets', 'Grips', 'Bracers'],
  cape:      ['Cape', 'Mantle', 'Pall'],          // the flex/identity slot (§4)
  pet:       ['Familiar', 'Effigy', 'Wisp'],
  weapon:    ['Blade', 'Bow', 'Stave'],           // overridden by weaponKind
  accessory: ['Ring', 'Charm', 'Sigil'],
};

export const WEAPON_KINDS = ['Blade', 'Bow', 'Stave']; // §4 sword / bow / staff

// Rarity ladder, low→high. `perks` = how many perk slots roll. `power` scales
// every perk's rolled magnitude, so higher rarity = bigger numbers AND more of
// them. `weight` drives the base drop distribution (before difficulty bumps it).
export const RARITIES = [
  { key: 'common',    tier: 0, label: 'Common',    perks: 1, power: 0.55, weight: 60, color: RARITY_COLOR.common },
  { key: 'uncommon',  tier: 1, label: 'Uncommon',  perks: 2, power: 0.75, weight: 30, color: RARITY_COLOR.uncommon },
  { key: 'rare',      tier: 2, label: 'Rare',      perks: 3, power: 1.00, weight: 14, color: RARITY_COLOR.rare },
  { key: 'epic',      tier: 3, label: 'Epic',      perks: 4, power: 1.25, weight: 5,  color: RARITY_COLOR.epic },
  { key: 'legendary', tier: 4, label: 'Legendary', perks: 5, power: 1.45, weight: 1.4, color: RARITY_COLOR.legendary },
  { key: 'mythic',    tier: 5, label: 'Mythic',    perks: 6, power: 1.65, weight: 0.25, color: RARITY_COLOR.mythic },
];

export const RARITY_BY_KEY = Object.fromEntries(RARITIES.map((r) => [r.key, r]));

// Perk pool. `mod` is the canonical modifier key the Inventory aggregates and
// the gameplay reads (see MODIFIERS below). `roll` is the magnitude range in
// PERCENT POINTS, before the rarity `power` multiplier. `slots` gates where a
// perk can appear — note the cape pool is deliberately weighted to movement /
// fortune / aura / cosmetic, making it the flex slot (§4). `cosmetic` perks are
// pure flex (no mechanical effect) — the status items that "price highest" (§4).
export const PERKS = [
  { key: 'power',   mod: 'heroDamage',     label: 'Power',        roll: [4, 14],  slots: ['weapon', 'hands', 'chest'],            weight: 10 },
  { key: 'siege',   mod: 'towerDamage',    label: 'Siege',        roll: [5, 16],  slots: ['head', 'chest', 'accessory', 'pet'],   weight: 10 },
  { key: 'edge',    mod: 'critChance',     label: 'Keen Edge',    roll: [3, 10],  slots: ['weapon', 'accessory', 'head'],         weight: 8  },
  { key: 'swift',   mod: 'moveSpeed',      label: 'Swiftness',    roll: [3, 12],  slots: ['feet', 'legs', 'cape'],                weight: 9  },
  { key: 'haste',   mod: 'attackSpeed',    label: 'Haste',        roll: [3, 11],  slots: ['hands', 'weapon', 'feet'],             weight: 8  },
  { key: 'leech',   mod: 'lifesteal',      label: 'Leeching',     roll: [2, 8],   slots: ['weapon', 'accessory', 'chest'],        weight: 6  },
  { key: 'fortune', mod: 'goldFind',       label: 'Fortune',      roll: [6, 22],  slots: ['accessory', 'pet', 'cape'],            weight: 7  },
  { key: 'arc',     mod: 'chainLightning', label: 'Arcing',       roll: [4, 12],  slots: ['weapon', 'pet', 'accessory'],          weight: 5  },
  // Cape-and-pet-only flex perks — cosmetic, no stats, just status (§4).
  { key: 'plume',   mod: 'cosmetic',       label: 'Spectral Trail', roll: [0, 0], slots: ['cape'],                                weight: 5, cosmetic: true },
  { key: 'mist',    mod: 'cosmetic',       label: 'Plague-Mist Aura', roll: [0, 0], slots: ['cape', 'pet'],                       weight: 4, cosmetic: true },
];

// Canonical modifier keys → how the magnitude is read. Everything is an additive
// percent (stored as a fraction by the Inventory) applied multiplicatively at
// the use site, EXCEPT `cosmetic` which has no mechanical effect.
export const MODIFIERS = {
  heroDamage:     { label: '+% Hero Damage',  kind: 'percent' },
  towerDamage:    { label: '+% Tower Damage', kind: 'percent' },
  critChance:     { label: '+% Crit Chance',  kind: 'percent' },
  moveSpeed:      { label: '+% Move Speed',   kind: 'percent' },
  attackSpeed:    { label: '+% Attack Speed', kind: 'percent' },
  lifesteal:      { label: '+% Lifesteal',    kind: 'percent' },
  goldFind:       { label: '+% Gold Find',    kind: 'percent' },
  chainLightning: { label: '+% Chain Lightning', kind: 'percent' },
  cosmetic:       { label: 'Cosmetic flex',   kind: 'flex' },
};

export const CRIT_MULTIPLIER = 2.0; // a crit hits for double (§4 "+crit")

// Thematic name parts — loot is "recovered history", relics of fallen Wardens
// (§2), so names lean grim/medieval rather than generic RPG.
export const NAME_PREFIX = {
  common:    ['Worn', 'Cracked', 'Plain', 'Dull'],
  uncommon:  ['Tempered', 'Warded', 'Hollow-touched', 'Ashen'],
  rare:      ['Sealbound', 'Grave-forged', 'Bonewrought', 'Wraithsteel'],
  epic:      ['Breachsworn', 'Plaguecrowned', 'Revenant', 'Mourncast'],
  legendary: ['Hollow King’s', 'Last Ward', 'Undying', 'Cathedral-born'],
  mythic:    ['Ossuary Eternal', 'The Sovereign’s', 'Worldseal', 'Doomspoken'],
};
export const NAME_SUFFIX = { // tied to the item's strongest perk
  power: 'of Ruin', siege: 'of the Siege', edge: 'of the Keen', swift: 'of Swiftness',
  haste: 'of Fury', leech: 'of Leeching', fortune: 'of Avarice', arc: 'of the Storm',
  plume: 'of Vanity', mist: 'of the Pall',
};

// ── DROP TABLES — the §4 anti-farm rule made concrete: "rare/high-tier loot
// drops only from hard, completed content. Difficulty gates value." Each source
// defines a drop chance and the rarity floor/distribution it can roll. Trash mobs
// can never cough up a legendary; bosses and full clears are where value lives.
export const DROP_SOURCES = {
  shambler: { chance: 0.10, table: { common: 80, uncommon: 20 } },
  runner:   { chance: 0.10, table: { common: 75, uncommon: 25 } },
  brute:    { chance: 0.45, table: { uncommon: 55, rare: 40, epic: 5 } },
  // Boss: guaranteed drop, epic floor, real shot at legendary/mythic (§4).
  herald:   { chance: 1.00, count: 2, table: { rare: 30, epic: 45, legendary: 22, mythic: 3 } },
  // Surviving the whole breach (full clear / win) — guaranteed high-tier reward.
  clear:    { chance: 1.00, table: { epic: 55, legendary: 40, mythic: 5 } },
};
