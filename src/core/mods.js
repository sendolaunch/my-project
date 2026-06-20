// Combine any number of modifier blocks by summing their numeric keys. Gear
// (§4) and skills (§5) emit the same canonical keys, so the player's effective
// loadout is just the additive merge of both. Non-numeric props are ignored.

export function mergeMods(...blocks) {
  const out = {};
  for (const b of blocks) {
    if (!b) continue;
    for (const k in b) {
      if (typeof b[k] === 'number') out[k] = (out[k] || 0) + b[k];
    }
  }
  return out;
}
