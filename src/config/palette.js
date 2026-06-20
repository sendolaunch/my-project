// Brand palette — locked in design doc §12. Every color in the game references
// these constants so the art direction stays cohesive (the §14 requirement:
// "a locked palette makes it look intentional even with simple models").
// Do not introduce ad-hoc hex values elsewhere; add a named token here instead.

export const PALETTE = {
  voidBlack:   0x070806, // background / deep shadow
  bone:        0xE9E4D2, // text, ward, friendly accents
  plagueGreen: 0x6EE65A, // primary glow — hero, crit, the Hollow King's reach
  rotGreen:    0x2c6b27, // secondary green — towers, terrain accents
  ash:         0x8f886f, // neutral stone / UI chrome

  // Derived gameplay tints (kept here so combat colors are also centralized)
  enemy:       0x9bd089, // sickly pale-green for the Hollow (the dead)
  enemyHurt:   0xE9E4D2, // flash to bone-white on hit
  buildable:   0x1a2417, // tintable tile that can hold a tower
  path:        0x14110d, // the breach path the dead walk
  danger:      0xb83a2e, // ward-damage / lose feedback (rare, used sparingly)
};

// Rarity ladder (§4). Kept in the central color authority so item tints, the
// stash UI and any in-world drop FX all read the same value. Leans on brand
// where it counts — legendary is the plague-green hero/king glow — while still
// giving the eye a readable common→mythic progression.
export const RARITY_COLOR = {
  common:    0x8f886f, // ash
  uncommon:  0x5a9f48, // muted blight-green
  rare:      0x3a9bb8, // cold ward-teal
  epic:      0x9a5cc8, // violet
  legendary: 0x6EE65A, // plague-green (the relic glow)
  mythic:    0xf0c044, // searing bone-gold
};

// CSS-friendly helpers for the DOM HUD (§14: carry the brand into the whole UI).
export const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

export const CSS = {
  voidBlack:   css(PALETTE.voidBlack),
  bone:        css(PALETTE.bone),
  plagueGreen: css(PALETTE.plagueGreen),
  rotGreen:    css(PALETTE.rotGreen),
  ash:         css(PALETTE.ash),
  danger:      css(PALETTE.danger),
};
