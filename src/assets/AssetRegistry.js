import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';

// ── The art boundary (§14) ────────────────────────────────────────────────────
// Every visual in the game is produced here and ONLY here. Gameplay code asks
// `Assets.create('hero')` and gets back a THREE.Object3D whose origin sits at
// ground level (y=0). It never knows whether that came from primitive geometry
// (now) or a loaded GLTF (later).
//
// To swap a placeholder for real art, replace one builder below with something
// like:
//     hero: () => gltfCache.get('hero').scene.clone()
// ...and nothing in entities/ or systems/ changes. That is the whole point of
// keeping models out of game logic.
//
// Placeholders are intentionally simple but on-brand (locked palette §12) so the
// blocky first playable still reads as OSSARA, not as "unfinished" (§14).

// Shared geometry — created once, reused across every instance (perf budget).
const geo = {
  heroBody:  new THREE.CylinderGeometry(0.22, 0.30, 0.7, 6),
  heroHead:  new THREE.IcosahedronGeometry(0.20, 0),
  enemy:     new THREE.IcosahedronGeometry(1, 0),       // scaled per type
  projectile:new THREE.SphereGeometry(0.12, 8, 8),
  towerBase: new THREE.CylinderGeometry(0.34, 0.42, 0.25, 8),
  spike:     new THREE.ConeGeometry(0.08, 0.4, 5),
  ballistaArm: new THREE.BoxGeometry(0.7, 0.08, 0.08),
  spireShaft: new THREE.CylinderGeometry(0.10, 0.16, 1.1, 6),
  crystal:   new THREE.OctahedronGeometry(0.24, 0),
  wardCore:  new THREE.OctahedronGeometry(0.55, 0),
};

const mat = {
  bone:  new THREE.MeshStandardMaterial({ color: PALETTE.bone, roughness: 0.8, metalness: 0.1 }),
  ash:   new THREE.MeshStandardMaterial({ color: PALETTE.ash,  roughness: 0.9, metalness: 0.1 }),
  rot:   new THREE.MeshStandardMaterial({ color: PALETTE.rotGreen, roughness: 0.7, metalness: 0.2 }),
};

// A fresh emissive material clone — used where we need per-instance tinting
// (hit flashes) or a glow. Cheap: at most ~120 enemies + a few towers.
function glow(color, intensity = 0.9) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.5,
    metalness: 0.0,
  });
}

const builders = {
  hero() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(geo.heroBody, mat.ash.clone());
    body.position.y = 0.35;
    const head = new THREE.Mesh(geo.heroHead, glow(PALETTE.plagueGreen, 1.1));
    head.position.y = 0.85;
    g.add(body, head);
    g.userData.tintMesh = head;     // what flashes / dims on damage
    return g;
  },

  enemy(def) {
    // One builder for every Hollow type; `def` carries radius/color from config.
    const m = glow(def.color, def.boss ? 0.9 : 0.5);
    const mesh = new THREE.Mesh(geo.enemy, m);
    const r = def.radius;
    mesh.scale.set(r, r * 1.25, r);  // slightly tall = hunched silhouette
    mesh.position.y = r * 1.05;
    const g = new THREE.Group();
    g.add(mesh);
    g.userData.tintMesh = mesh;
    g.userData.baseEmissive = def.boss ? 0.9 : 0.5;
    return g;
  },

  projectile(color) {
    return new THREE.Mesh(geo.projectile, glow(color, 1.4));
  },

  tower(kind, def) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(geo.towerBase, mat.ash.clone());
    base.position.y = 0.12;
    g.add(base);

    if (kind === 'spikegate') {
      const m = glow(def.color, 0.6);
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18], [0, 0]]) {
        const s = new THREE.Mesh(geo.spike, m);
        s.position.set(dx, 0.42, dz);
        g.add(s);
      }
      g.userData.headPivot = null; // doesn't rotate to aim
    } else if (kind === 'ballista') {
      const post = new THREE.Mesh(geo.spireShaft, mat.rot.clone());
      post.scale.y = 0.45; post.position.y = 0.45;
      const arm = new THREE.Mesh(geo.ballistaArm, glow(def.color, 0.4));
      arm.position.y = 0.7;
      g.add(post, arm);
      g.userData.headPivot = arm;  // yaws to face target
    } else if (kind === 'spire') {
      const shaft = new THREE.Mesh(geo.spireShaft, mat.rot.clone());
      shaft.position.y = 0.55;
      const crystal = new THREE.Mesh(geo.crystal, glow(def.color, 1.2));
      crystal.position.y = 1.2;
      g.add(shaft, crystal);
      g.userData.headPivot = crystal; // spins for flavor
    }
    return g;
  },

  ward() {
    const g = new THREE.Group();
    const core = new THREE.Mesh(geo.wardCore, glow(PALETTE.bone, 0.8));
    core.position.y = 0.8;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.06, 6, 16),
      glow(PALETTE.plagueGreen, 0.7)
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.8;
    g.add(core, ring);
    g.userData.tintMesh = core;
    return g;
  },
};

export const Assets = {
  /**
   * @param {string} key   'hero' | 'enemy' | 'projectile' | 'tower' | 'ward'
   * @param  {...any} args  builder-specific (enemy def, tower kind+def, etc.)
   * @returns {THREE.Object3D}
   */
  create(key, ...args) {
    const b = builders[key];
    if (!b) throw new Error(`AssetRegistry: no builder for "${key}"`);
    return b(...args);
  },
};
