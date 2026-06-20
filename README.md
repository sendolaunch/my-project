# OSSARA

> Hold the breach. Loot the dead.

A co-op tower-defense game on Solana with a player-driven loot economy. Browser-based,
dark-plague medieval theme. See the master design doc for the full plan; this repo is the
build of that plan.

This commit delivers **§9, step 1 — the single-player slice**: one isometric map, tower
placement, one controllable hero, escalating waves, win/lose. The economy, loot, wallet and
co-op come later, on purpose (§9 build order: *fun game first, money bolted on once it's fun*).

## Run it

The slice is plain ES modules + [Three.js](https://threejs.org) from a CDN — **no build step**.
You just need to serve the folder over HTTP (ES modules don't load from `file://`).

```bash
npm start          # serves on http://localhost:5173  (uses `npx serve`)
# — or any static server —
python3 -m http.server 5173
```

Then open <http://localhost:5173>.

## How to play

- **Begin defense** (top button) opens the breach and starts wave 1.
- Pick a defense from the bar (or press **1 / 2 / 3**), then **click a tile** to place it. Defenses cost Gold; you earn Gold by killing the Hollow.
- **WASD** moves your Warden, who auto-attacks the nearest enemy in range. Position matters — standing in the horde gets you downed for a few seconds.
- Each enemy that reaches the **ward** chips its integrity. Lose if it hits zero; win by surviving all six waves. Call waves early for pressure with the wave button.

## Architecture

Built to the design doc's §14 requirements from the start — performance and art-separation
are designed in, not bolted on.

```
index.html              # import-map + canvas; swap to a bundler later, imports unchanged
src/
  config/               # all tunables as DATA, no Three.js (§4) — shareable with the future server
    palette.js          #   locked brand palette (§12)
    gameConfig.js       #   grid, path, waves, towers, enemies, hero, entity caps
  core/
    Renderer.js         # orthographic isometric camera, lights, pointer→ground raycast
    Input.js            # keyboard (polled) + pointer (events)
    ObjectPool.js       # fixed-size recycling — the §14 perf backbone
    Game.js             # conductor: pools, combat, economy, main loop
  assets/
    AssetRegistry.js    # THE art boundary (§14). Placeholder geometry today; swap one
                        #   builder for a GLTF and nothing in gameplay changes.
  world/World.js        # ground (1 instanced draw call), breach path, placement rules
  entities/             # Hero, Enemy (pooled), Tower, Projectile (pooled)
  systems/WaveSystem.js # escalating wave director
  ui/                   # DOM HUD + brand-themed CSS
```

### Two principles carried everywhere

- **Art is separate from code.** Every visual comes from `AssetRegistry`. Gameplay asks for
  `'hero'` or `'enemy'` and gets a `THREE.Object3D`; it never knows if that's a primitive or a
  sculpted model. The later paid-art upgrade is a file swap, not a rewrite (§14).
- **Lean by default.** Enemies and projectiles are pooled to a hard cap; ground is one
  instanced mesh; DPR is clamped for phones; distances are compared squared in hot loops (§14).

## Roadmap (design doc §9)

1. ✅ **Single-player slice** — *this build*.
2. Gear system — drops, rarities, perks, rolled stats, inventory.
3. Hero progression + skill tree + a second map.
4. Co-op — 2–4 players, real-time WebSocket server.
5. The Undercroft (instanced) + marketplace + wallet + Gold/$OSSA/USDC economy.

Tech stack is intentionally Three.js + (later) a small WebSocket server, browser-first (§13).
