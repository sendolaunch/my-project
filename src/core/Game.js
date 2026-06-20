import * as THREE from 'three';
import { Renderer } from './Renderer.js';
import { Input } from './Input.js';
import { ObjectPool } from './ObjectPool.js';
import { World } from '../world/World.js';
import { Hero } from '../entities/Hero.js';
import { Enemy } from '../entities/Enemy.js';
import { Tower } from '../entities/Tower.js';
import { Projectile } from '../entities/Projectile.js';
import { WaveSystem } from '../systems/WaveSystem.js';
import { HUD } from '../ui/HUD.js';
import { TOWERS, ENEMIES, WARD, ECONOMY, LIMITS } from '../config/gameConfig.js';

// The conductor. Owns the world, pools, hero, towers and wave director; resolves
// combat and economy; runs the fixed-ish main loop. Keeps zero rendering detail
// (Renderer) and zero balancing numbers (gameConfig) of its own.

const _splashCenter = new THREE.Vector3();

export class Game {
  constructor(canvas, uiRoot) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.scene = this.renderer.scene;
    this.world = new World(this.scene);
    this.hero = new Hero(this.scene, this.world);

    // Pre-allocated pools (§14): build to the cap once, recycle forever.
    this.enemies = new ObjectPool(LIMITS.maxEnemies, () => new Enemy(this.scene, this.world));
    this.projectiles = new ObjectPool(LIMITS.maxProjectiles, () => new Projectile(this.scene));

    this.towers = [];
    this.hud = new HUD(uiRoot, {
      onSelectTower: (kind) => { this.selectedTower = kind; },
      onCallWave: () => this._onCallWave(),
      onRestart: () => this.reset(),
    });

    this.spawnProjectile = this.spawnProjectile.bind(this);
    this._spawnEnemy = this._spawnEnemy.bind(this);

    this.reset();

    this._last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  reset() {
    // Recycle everything in the pools and clear the board.
    this.enemies.forEachActive((e) => { e.hide(); this.enemies.release(e); });
    this.projectiles.forEachActive((p) => { p.hide(); this.projectiles.release(p); });
    for (const t of this.towers) this.scene.remove(t.object);
    this.towers = [];
    this.world.occupied.clear();

    this.gold = ECONOMY.startingGold;
    this.ward = WARD.maxIntegrity;
    this.selectedTower = null;
    this.state = 'playing';          // 'playing' | 'won' | 'lost'

    this.waves = new WaveSystem(this._spawnEnemy);
    this.hero._revive();
    this.hud.clearSelection();
    this.hud.hideResult();
  }

  _onCallWave() {
    if (this.state !== 'playing') return;
    if (!this.waves.started) this.waves.start();
    else this.waves.startEarly();
  }

  // ── Spawning ────────────────────────────────────────────────────────────────
  _spawnEnemy(typeKey) {
    this.enemies.acquire(typeKey);   // null when at cap → spawn skipped, by design
  }

  spawnProjectile(origin, target, damage, speed, splash, color) {
    this.projectiles.acquire(origin, target, damage, speed, splash, color);
  }

  // ── Placement ─────────────────────────────────────────────────────────────
  _tryPlace(ndcX, ndcY) {
    if (!this.selectedTower) return;
    const def = TOWERS[this.selectedTower];
    const ground = this.renderer.pointerToGround(ndcX, ndcY);
    if (!ground) return;
    const { col, row } = this.world.worldToGrid(ground.x, ground.z);
    if (!this.world.canBuild(col, row) || this.gold < def.cost) return;

    this.towers.push(new Tower(this.scene, this.world, this.selectedTower, col, row));
    this.world.markOccupied(col, row);
    this.gold -= def.cost;
    if (this.gold < def.cost) this.hud.clearSelection(); // can't afford another
  }

  // ── Combat resolution ───────────────────────────────────────────────────────
  _resolveHit(p) {
    if (p.splash > 0) {
      _splashCenter.copy(p.object.position);
      const r2 = p.splash * p.splash;
      this.enemies.forEachActive((e) => {
        const dx = e.position().x - _splashCenter.x;
        const dz = e.position().z - _splashCenter.z;
        if (dx * dx + dz * dz <= r2) {
          if (e.damage(p.damage)) this._killEnemy(e);
        }
      });
    } else if (p.target && p.target.active) {
      if (p.target.damage(p.damage)) this._killEnemy(p.target);
    }
  }

  _killEnemy(e) {
    this.gold += e.reward;           // Gold from kills (§6.1 soft currency)
    e.hide();
    this.enemies.release(e);
  }

  _contactDamage(dt) {
    if (this.hero.downed) return;
    const hp = this.hero.position();
    let dps = 0;
    this.enemies.forEachActive((e) => {
      const dx = e.position().x - hp.x;
      const dz = e.position().z - hp.z;
      const reach = e.radius + 0.45;
      if (dx * dx + dz * dz <= reach * reach) dps += e.wardDamage * 3;
    });
    if (dps > 0) this.hero.takeDamage(dps * dt);
  }

  // ── Main loop ────────────────────────────────────────────────────────────────
  _loop(now) {
    const dt = Math.min((now - this._last) / 1000, 0.05); // clamp tab-switch spikes
    this._last = now;

    if (this.state === 'playing') this._update(dt);
    this.renderer.render();
    requestAnimationFrame(this._loop);
  }

  _update(dt) {
    // Placement clicks (left button only).
    for (const c of this.input.drainClicks()) {
      if (c.button === 0) this._tryPlace(c.x, c.y);
      else this.hud.clearSelection(); // right-click cancels
    }

    // Hover preview while a defense is selected.
    if (this.selectedTower && this.input.pointerOnScreen) {
      const g = this.renderer.pointerToGround(this.input.pointerNDC.x, this.input.pointerNDC.y);
      if (g) { const { col, row } = this.world.worldToGrid(g.x, g.z); this.world.showHover(col, row); }
      else this.world.hideHover();
    } else {
      this.world.hideHover();
    }

    this.waves.update(dt);

    // Enemies — advance; those reaching the ward damage it and are recycled.
    this.enemies.forEachActive((e) => {
      if (e.update(dt) === 'reached') {
        this.ward -= e.wardDamage;
        e.hide();
        this.enemies.release(e);
      }
    });

    for (const t of this.towers) t.update(dt, this.enemies, this.spawnProjectile);
    this.hero.update(dt, this.input, this.enemies, this.spawnProjectile);

    // Projectiles — resolve hits / expiries.
    this.projectiles.forEachActive((p) => {
      const status = p.update(dt);
      if (status === 'hit') { this._resolveHit(p); p.hide(); this.projectiles.release(p); }
      else if (status === 'expired') { p.hide(); this.projectiles.release(p); }
    });

    this._contactDamage(dt);
    this._checkEndState();
    this._pushHud();
  }

  _checkEndState() {
    if (this.ward <= 0) {
      this.ward = 0;
      this.state = 'lost';
      this.hud.showResult(false);
    } else if (this.waves.allWavesSpawned && this.enemies.countActive() === 0) {
      this.state = 'won';
      this.hud.showResult(true);
    }
  }

  _pushHud() {
    this.hud.update({
      gold: Math.floor(this.gold),
      ward: this.ward,
      wave: this.waves.currentWaveNumber,
      totalWaves: this.waves.totalWaves,
      started: this.waves.started,
      inCooldown: this.waves.inCooldown,
    });
  }
}
