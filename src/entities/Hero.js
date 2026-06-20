import * as THREE from 'three';
import { Assets } from '../assets/AssetRegistry.js';
import { HERO } from '../config/gameConfig.js';
import { CRIT_MULTIPLIER } from '../items/itemDefs.js';
import { PALETTE } from '../config/palette.js';

// The player-controlled Warden (§3 "The Wall"). WASD to move, auto-attacks the
// nearest Hollow in range. Taking contact damage downs the hero for a few
// seconds (no game-over — the lose condition is the ward, §9.1). Stats are
// data-driven so other orders drop in by passing a different def.

const _move = new THREE.Vector3();
const _v = new THREE.Vector3();

export class Hero {
  constructor(scene, world, def = HERO.warden) {
    this.def = def;
    this.world = world;
    this.object = Assets.create('hero');
    this.object.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.object);
    this.tintMesh = this.object.userData.tintMesh;

    this.baseMaxHp = def.maxHp;
    this.maxHp = def.maxHp;                   // recomputed by setMods (§5 Support)
    this.hp = def.maxHp;
    this.regen = 0;                           // HP/sec from skills
    this.range2 = def.attackRange * def.attackRange;
    this.cooldown = 0;
    this.downed = false;
    this.downTimer = 0;
    this.contactTick = 0;

    this.setWorld(world);
  }

  // Bind to a (possibly new) map and rally near its breach lane.
  setWorld(world) {
    this.world = world;
    this.home = world.worldPath[1].clone();   // first bend — in-bounds, near the action
    this.object.position.copy(this.home);
  }

  // Apply the merged gear+skill modifiers that affect persistent stats (§5).
  setMods(mods) {
    this.maxHp = this.baseMaxHp * (1 + (mods.heroMaxHp || 0));
    this.hp = Math.min(this.hp, this.maxHp);
    this.regen = mods.heroRegen || 0;
  }

  update(dt, input, enemyPool, spawnProjectile, mods = {}) {
    if (this.downed) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) this._revive();
      return;
    }

    // Passive regen from the Support tree (§5).
    if (this.regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

    // Equipped gear scales the base stats (§4 perks → live effects).
    const moveSpeed = this.def.moveSpeed * (1 + (mods.moveSpeed || 0));
    const atkSpeed = this.def.attacksPerSec * (1 + (mods.attackSpeed || 0));

    // Movement — normalized so diagonals aren't faster.
    const mv = input.moveVector();
    _move.set(mv.x, 0, mv.z);
    if (_move.lengthSq() > 0) {
      _move.normalize().multiplyScalar(moveSpeed * dt);
      this.object.position.add(_move);
      this._clampToBoard();
      this.object.rotation.y = Math.atan2(_move.x, _move.z);
    }

    // Auto-attack nearest enemy in range.
    this.cooldown -= dt;
    let best = null, bestD = this.range2;
    const here = this.object.position;
    enemyPool.forEachActive((e) => {
      const dx = e.position().x - here.x;
      const dz = e.position().z - here.z;
      const d = dx * dx + dz * dz;
      if (d <= bestD) { bestD = d; best = e; }
    });
    if (best && this.cooldown <= 0) {
      let damage = this.def.attackDamage * (1 + (mods.heroDamage || 0));
      const crit = Math.random() < (mods.critChance || 0);
      if (crit) damage *= CRIT_MULTIPLIER;
      const muzzle = _v.copy(here); muzzle.y = 0.85;
      spawnProjectile(muzzle, best, damage, this.def.projectileSpeed, 0,
        crit ? PALETTE.bone : this.def.color,
        { fromHero: true, crit, lifesteal: mods.lifesteal || 0, chain: mods.chainLightning || 0 });
      this.cooldown = 1 / atkSpeed;
    }
  }

  heal(amount) {
    if (this.downed) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** Contact damage from an overlapping enemy (called by the combat resolver). */
  takeDamage(amount) {
    if (this.downed) return;
    this.hp -= amount;
    if (this.hp <= 0) this._down();
  }

  _down() {
    this.downed = true;
    this.downTimer = this.def.downtime;
    this.object.visible = false;
  }

  _revive() {
    this.downed = false;
    this.hp = this.maxHp;
    this.object.position.copy(this.home);
    this.object.visible = true;
  }

  _clampToBoard() {
    const halfW = this.world.width / 2 - 0.4;
    const halfD = this.world.depth / 2 - 0.4;
    const p = this.object.position;
    p.x = Math.max(-halfW, Math.min(halfW, p.x));
    p.z = Math.max(-halfD, Math.min(halfD, p.z));
  }

  position() { return this.object.position; }
}
