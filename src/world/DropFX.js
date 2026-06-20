import { Assets } from '../assets/AssetRegistry.js';
import { RARITY_COLOR } from '../config/palette.js';

// Tiny pooled effect: when loot drops, a rarity-colored mote rises and fades at
// the kill site. Pure juice, but it's what makes a drop *read* as a drop. Pooled
// and capped like everything else (§14) — a handful of motes, reused forever.

const POOL = 18;

export class DropFX {
  constructor(scene) {
    this.scene = scene;
    this.sparks = [];
    for (let i = 0; i < POOL; i++) {
      const mesh = Assets.create('lootSpark');
      mesh.visible = false;
      scene.add(mesh);
      this.sparks.push({ mesh, life: 0, ttl: 1 });
    }
  }

  spawn(worldPos, rarityKey) {
    const s = this.sparks.find((x) => x.life <= 0);
    if (!s) return;                          // all busy — drop the FX, never the item
    s.mesh.position.set(worldPos.x, 0.8, worldPos.z);
    s.mesh.material.color.setHex(RARITY_COLOR[rarityKey] || RARITY_COLOR.common);
    s.mesh.material.opacity = 1;
    s.mesh.scale.setScalar(1);
    s.mesh.visible = true;
    s.ttl = 1.1;
    s.life = s.ttl;
  }

  update(dt) {
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const k = Math.max(0, s.life / s.ttl);
      s.mesh.position.y += dt * 1.6;         // float up
      s.mesh.rotation.y += dt * 4;
      s.mesh.material.opacity = k;
      s.mesh.scale.setScalar(0.4 + k * 0.8);
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
}
