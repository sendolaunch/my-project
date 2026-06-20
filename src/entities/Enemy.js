import * as THREE from 'three';
import { Assets } from '../assets/AssetRegistry.js';
import { ENEMIES } from '../config/gameConfig.js';

// A Hollow — one of the dead pouring through the breach (§2). Pooled: the visual
// is built once and reconfigured on reset(), never re-allocated. Follows the
// world's fixed waypoint path toward the ward.

const TURN = 0.18; // reuse one vector to avoid per-frame allocations
const _dir = new THREE.Vector3();

export class Enemy {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    // Built from a representative def so the structure (group + tint mesh) exists;
    // reset() restyles it per actual type.
    this.object = Assets.create('enemy', ENEMIES.shambler);
    this.tintMesh = this.object.userData.tintMesh;
    this.object.visible = false;
    scene.add(this.object);
    this.active = false;
  }

  reset(typeKey) {
    const def = ENEMIES[typeKey];
    this.typeKey = typeKey;
    this.def = def;
    this.maxHp = def.maxHp;
    this.hp = def.maxHp;
    this.speed = def.moveSpeed;
    this.wardDamage = def.wardDamage;
    this.reward = def.reward;
    this.radius = def.radius;
    this.isBoss = !!def.boss;
    this.reachedWard = false;
    this.hitFlash = 0;

    // Restyle the shared visual to this type.
    const r = def.radius;
    this.tintMesh.scale.set(r, r * 1.25, r);
    this.tintMesh.position.y = r * 1.05;
    this.tintMesh.material.color.setHex(def.color);
    this.tintMesh.material.emissive.setHex(def.color);
    this.baseEmissive = def.boss ? 0.9 : 0.5;
    this.tintMesh.material.emissiveIntensity = this.baseEmissive;

    // Spawn at the breach, head for the next waypoint.
    this.object.position.copy(this.world.worldPath[0]);
    this.wpIndex = 1;
    this.object.visible = true;
  }

  /** @returns {'alive'|'reached'} — 'reached' means it hit the ward this frame. */
  update(dt) {
    // Damage flash decays back to the resting emissive.
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
      this.tintMesh.material.emissiveIntensity = this.baseEmissive + this.hitFlash * 2;
    }

    const path = this.world.worldPath;
    const target = path[this.wpIndex];
    _dir.copy(target).sub(this.object.position);
    _dir.y = 0;
    const dist = _dir.length();
    const step = this.speed * dt;

    if (dist <= step) {
      this.object.position.copy(target);
      this.wpIndex++;
      if (this.wpIndex >= path.length) {
        this.reachedWard = true;
        return 'reached';
      }
    } else {
      _dir.multiplyScalar(step / dist);
      this.object.position.add(_dir);
      // Face travel direction (cheap yaw).
      const yaw = Math.atan2(_dir.x, _dir.z);
      this.object.rotation.y += (yaw - this.object.rotation.y) * TURN;
    }
    return 'alive';
  }

  /** @returns {boolean} true if this hit killed it. */
  damage(amount) {
    this.hp -= amount;
    this.hitFlash = 1;
    return this.hp <= 0;
  }

  hide() { this.object.visible = false; }

  position() { return this.object.position; }
}
