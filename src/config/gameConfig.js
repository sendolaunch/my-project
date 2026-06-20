// All gameplay tunables live here — balancing is data, not code (§4 "all data,
// not art"). Nothing in this file imports Three.js; it is pure numbers so it can
// later be shared with the authoritative co-op server (§9.4) unchanged.

export const GRID = {
  cols: 18,
  rows: 12,
  tile: 1,        // world units per tile
};

// The single map's breach path (§9.1 "one map"). A fixed waypoint list instead
// of runtime A* — reliable for a slice and trivial for enemies to follow. The
// breach (spawn) is the first cell, the ward (defend point) is the last.
// Cells between waypoints are filled cardinally to mark non-buildable path tiles.
export const PATH_WAYPOINTS = [
  { col: 0,  row: 6 },
  { col: 4,  row: 6 },
  { col: 4,  row: 2 },
  { col: 9,  row: 2 },
  { col: 9,  row: 9 },
  { col: 13, row: 9 },
  { col: 13, row: 5 },
  { col: 17, row: 5 }, // the ward
];

export const WARD = {
  maxIntegrity: 20,   // lose when this hits 0
};

export const ECONOMY = {
  startingGold: 150,  // in-game soft currency only (§6.1); not $OSSA
};

export const HERO = {
  // Default order: the Warden / "The Wall" (§3). Class is data-driven so the
  // Hunter / Stormcaller / Plague Doctor drop in by adding entries like this.
  warden: {
    name: 'Warden',
    order: 'The Wall',
    maxHp: 220,
    moveSpeed: 5.0,        // units/sec
    attackRange: 3.0,
    attackDamage: 14,
    attacksPerSec: 2.0,
    projectileSpeed: 14,
    downtime: 6.0,         // seconds out of action if HP hits 0 (no game-over)
    color: 0x6EE65A,       // plague-green — the hero glows
  },
};

// Defenses are pulled straight from the class kit table in §3.
export const TOWERS = {
  spikegate: {
    name: 'Spike-Gate',
    order: 'Warden',
    cost: 50,
    range: 2.4,
    damage: 9,
    attacksPerSec: 1.6,
    projectileSpeed: 16,
    splash: 0,
    color: 0x2c6b27,       // rot-green
  },
  ballista: {
    name: 'Ballista',
    order: 'Hunter',
    cost: 90,
    range: 6.5,
    damage: 26,
    attacksPerSec: 0.75,
    projectileSpeed: 26,
    splash: 0,
    color: 0x8f886f,       // ash
  },
  spire: {
    name: 'Elemental Spire',
    order: 'Stormcaller',
    cost: 130,
    range: 4.6,
    damage: 16,
    attacksPerSec: 0.9,
    projectileSpeed: 18,
    splash: 1.8,           // AoE — damages all enemies within this radius on hit
    color: 0x6EE65A,       // plague-green
  },
};

// The Hollow — the dead that pour through the breach (§2).
export const ENEMIES = {
  shambler: { name: 'Shambler', maxHp: 30,  moveSpeed: 1.6, wardDamage: 1, reward: 6,  radius: 0.32, color: 0x9bd089 },
  runner:   { name: 'Runner',   maxHp: 18,  moveSpeed: 3.2, wardDamage: 1, reward: 5,  radius: 0.26, color: 0xbfe0a3 },
  brute:    { name: 'Brute',    maxHp: 130, moveSpeed: 1.1, wardDamage: 3, reward: 18, radius: 0.46, color: 0x7fb070 },
  herald:   { name: 'Herald of the Hollow King', maxHp: 650, moveSpeed: 1.0, wardDamage: 8, reward: 90, radius: 0.62, color: 0x6EE65A, boss: true },
};

// Escalating waves (§9.1). Each wave is a set of spawn groups; a group drips
// `count` enemies of one type every `interval` seconds. `gap` is the lull before
// the wave begins (0 = first wave waits for the player to start it).
export const WAVES = [
  { gap: 0,  groups: [ { type: 'shambler', count: 8,  interval: 1.0 } ] },
  { gap: 4,  groups: [ { type: 'shambler', count: 10, interval: 0.8 }, { type: 'runner', count: 4, interval: 1.2, delay: 3 } ] },
  { gap: 5,  groups: [ { type: 'runner',   count: 12, interval: 0.6 }, { type: 'brute',  count: 2, interval: 4.0, delay: 2 } ] },
  { gap: 6,  groups: [ { type: 'shambler', count: 14, interval: 0.6 }, { type: 'brute',  count: 4, interval: 3.0, delay: 1 } ] },
  { gap: 7,  groups: [ { type: 'runner',   count: 20, interval: 0.4 }, { type: 'brute',  count: 5, interval: 2.5, delay: 2 } ] },
  { gap: 8,  groups: [ { type: 'brute',    count: 6,  interval: 2.0 }, { type: 'herald', count: 1, interval: 1, delay: 6 } ] },
];

// Hard ceilings so a runaway spawn never tanks the framerate (§14 performance
// budget: "cap on-screen entity counts"). The pools (core/ObjectPool) allocate
// to these sizes once, up front, and never grow.
export const LIMITS = {
  maxEnemies: 120,
  maxProjectiles: 240,
};
