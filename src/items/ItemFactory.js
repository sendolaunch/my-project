import {
  RARITIES, RARITY_BY_KEY, PERKS, SLOTS, SLOT_NOUNS, WEAPON_KINDS,
  NAME_PREFIX, NAME_SUFFIX, DROP_SOURCES,
} from './itemDefs.js';

// Rolls items. All randomness flows through an injectable rng() so drops are
// reproducible in tests (seeded) and live in play (Math.random). The variance in
// perk magnitude is THE engine (§4): identical-looking items differ, and a
// near-max roll is a "god roll" worth hunting/paying for.

// ── RNG ───────────────────────────────────────────────────────────────────────
export function makeRng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let a = seed >>> 0;
  return function rng() {                     // mulberry32 — small, fast, seedable
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(items, rng, weightOf = (x) => x.weight) {
  let total = 0;
  for (const it of items) total += weightOf(it);
  let r = rng() * total;
  for (const it of items) { r -= weightOf(it); if (r <= 0) return it; }
  return items[items.length - 1];
}

let _idCounter = 0;
function newId() {
  _idCounter++;
  return `itm_${Date.now().toString(36)}_${_idCounter}_${Math.floor((typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.random() * 2 ** 32))}`;
}

// ── Perk rolling ──────────────────────────────────────────────────────────────
function rollPerkValue(def, rarity, rng) {
  const [min, max] = def.roll;
  const t = rng();                            // 0..1 → quality of this roll
  const raw = (min + t * (max - min)) * rarity.power;
  return {
    key: def.key,
    mod: def.mod,
    label: def.label,
    value: def.cosmetic ? 0 : Math.max(1, Math.round(raw)),
    quality: max > min ? t : 1,               // 1.0 == god roll for this perk
    cosmetic: !!def.cosmetic,
  };
}

function pickPerks(slot, count, rng) {
  const pool = PERKS.filter((p) => p.slots.includes(slot));
  const chosen = [];
  const used = new Set();
  // Can't roll more distinct perks than the slot's pool allows.
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const remaining = pool.filter((p) => !used.has(p.key));
    const def = weightedPick(remaining, rng);
    used.add(def.key);
    chosen.push(def);
  }
  return chosen;
}

// ── Naming ────────────────────────────────────────────────────────────────────
function makeName(rarityKey, slot, weaponKind, perks, rng) {
  const prefixes = NAME_PREFIX[rarityKey];
  const prefix = prefixes[Math.floor(rng() * prefixes.length)];
  let noun;
  if (slot === 'weapon') noun = weaponKind;
  else { const nouns = SLOT_NOUNS[slot]; noun = nouns[Math.floor(rng() * nouns.length)]; }
  // Suffix is tied to the strongest non-cosmetic perk so the name signals value.
  const lead = [...perks].sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  const suffix = lead ? (NAME_SUFFIX[lead.key] || '') : '';
  return `${prefix} ${noun} ${suffix}`.trim();
}

// ── Public API ────────────────────────────────────────────────────────────────
export function rollItem(slot, rarityKey, rng = Math.random) {
  const rarity = RARITY_BY_KEY[rarityKey];
  if (!rarity) throw new Error(`rollItem: unknown rarity "${rarityKey}"`);
  const weaponKind = slot === 'weapon' ? WEAPON_KINDS[Math.floor(rng() * WEAPON_KINDS.length)] : null;
  const perks = pickPerks(slot, rarity.perks, rng).map((def) => rollPerkValue(def, rarity, rng));

  // Item quality = average god-roll quality across mechanical perks (the meter
  // players chase). Cosmetic perks don't count toward it.
  const mech = perks.filter((p) => !p.cosmetic);
  const quality = mech.length ? mech.reduce((s, p) => s + p.quality, 0) / mech.length : 0;

  return {
    id: newId(),
    slot,
    weaponKind,
    rarity: rarityKey,
    name: makeName(rarityKey, slot, weaponKind, perks, rng),
    perks,
    quality,
  };
}

/** Pick a rarity key from a weighted distribution table { rarityKey: weight }. */
export function rollRarityFromTable(table, rng = Math.random) {
  const entries = Object.entries(table);
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = rng() * total;
  for (const [key, w] of entries) { r -= w; if (r <= 0) return key; }
  return entries[entries.length - 1][0];
}

/**
 * Roll the loot a drop source yields. Returns an array (0..n items). The source
 * key is one of DROP_SOURCES (enemy type or 'clear'). Difficulty gates value:
 * the source's own table decides the rarity floor (§4).
 */
export function rollDrop(sourceKey, rng = Math.random) {
  const src = DROP_SOURCES[sourceKey];
  if (!src) return [];
  const out = [];
  const count = src.count || 1;
  for (let i = 0; i < count; i++) {
    if (rng() > src.chance) continue;
    const rarityKey = rollRarityFromTable(src.table, rng);
    const slot = SLOTS[Math.floor(rng() * SLOTS.length)];
    out.push(rollItem(slot, rarityKey, rng));
  }
  return out;
}

export const RARITY_ORDER = RARITIES.map((r) => r.key);
