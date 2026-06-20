import * as THREE from 'three';
import { Assets } from '../assets/AssetRegistry.js';
import { TOWERS } from '../config/gameConfig.js';

// A placed defense (§3 class kits). Persistent (not pooled — far fewer towers
// than enemies). Auto-acquires the nearest enemy in range and fires on cooldown.

const _v = new THREE.Vector3();

export class Tower {
  constructor(scene, world, kind, col, row) {
    this.kind = kind;
    this.def = TOWERS[kind];
    this.col = col;
    this.row = row;
    this.object = Assets.create('tower', kind, this.def);
    this.object.position.copy(world.gridToWorld(col, row, 0));
    this.object.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.object);
    this.headPivot = this.object.userData.headPivot || null;
    this.cooldown = 0;
    this.range2 = this.def.range * this.def.range;
  }

  update(dt, enemyPool, spawnProjectile) {
    this.cooldown -= dt;
    if (this.headPivot && this.kind === 'spire') {
      this.headPivot.rotation.y += dt * 1.5;   // idle spin, pure flavor
    }

    // Nearest active enemy within range (squared distance — no sqrt in the loop).
    let best = null, bestD = this.range2;
    const here = this.object.position;
    enemyPool.forEachActive((e) => {
      const dx = e.position().x - here.x;
      const dz = e.position().z - here.z;
      const d = dx * dx + dz * dz;
      if (d <= bestD) { bestD = d; best = e; }
    });
    if (!best) return;

    if (this.headPivot && this.kind === 'ballista') {
      _v.copy(best.position()).sub(here);
      this.headPivot.parent.rotation.y = Math.atan2(_v.x, _v.z);
    }

    if (this.cooldown <= 0) {
      const muzzle = _v.copy(here); muzzle.y = 0.7;
      spawnProjectile(muzzle, best, this.def.damage, this.def.projectileSpeed, this.def.splash, this.def.color);
      this.cooldown = 1 / this.def.attacksPerSec;
    }
  }
}
