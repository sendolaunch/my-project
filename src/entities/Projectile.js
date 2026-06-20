import * as THREE from 'three';
import { Assets } from '../assets/AssetRegistry.js';

// A pooled shot fired by a tower or the hero. Homes toward its target enemy's
// current position; on contact it reports a hit so the combat resolver can apply
// single-target or splash damage. If the target dies mid-flight, the shot fizzles.

const _dir = new THREE.Vector3();
const HIT_RADIUS = 0.25;

export class Projectile {
  constructor(scene) {
    this.scene = scene;
    this.object = Assets.create('projectile', 0x6EE65A);
    this.object.visible = false;
    scene.add(this.object);
    this.active = false;
  }

  reset(origin, target, damage, speed, splash, color) {
    this.object.position.copy(origin);
    this.target = target;            // an Enemy (may go inactive mid-flight)
    this.damage = damage;
    this.speed = speed;
    this.splash = splash;
    this.object.material.color.setHex(color);
    this.object.material.emissive.setHex(color);
    this.object.visible = true;
    this.life = 2.5;                 // safety expiry (seconds)
  }

  /** @returns {'alive'|'hit'|'expired'} */
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) return 'expired';
    // Target gone (killed/recycled) → no homing point left; fizzle.
    if (!this.target || !this.target.active) return 'expired';

    _dir.copy(this.target.position()).sub(this.object.position);
    _dir.y = 0;
    const dist = _dir.length();
    const step = this.speed * dt;
    if (dist <= step + HIT_RADIUS) {
      this.object.position.copy(this.target.position());
      return 'hit';
    }
    _dir.multiplyScalar(step / dist);
    this.object.position.add(_dir);
    return 'alive';
  }

  hide() { this.object.visible = false; }
}
