import * as THREE from 'three';
import { Renderer } from './Renderer.js';
import { Input } from './Input.js';
import { ObjectPool } from './ObjectPool.js';
import { World } from '../world/World.js';
import { DropFX } from '../world/DropFX.js';
import { Hero } from '../entities/Hero.js';
import { Enemy } from '../entities/Enemy.js';
import { Tower } from '../entities/Tower.js';
import { Projectile } from '../entities/Projectile.js';
import { WaveSystem } from '../systems/WaveSystem.js';
import { LootSystem } from '../systems/LootSystem.js';
import { Inventory } from '../items/Inventory.js';
import { HUD } from '../ui/HUD.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { TOWERS, WARD, ECONOMY, LIMITS } from '../config/gameConfig.js';

// The conductor. Owns the world, pools, hero, towers, wave director, and now the
// gear loop (inventory + loot + drops). Resolves combat and economy and runs the
// main loop. Keeps zero rendering detail (Renderer) and zero balancing numbers
// (gameConfig / itemDefs) of its own.

const _splashCenter = new THREE.Vector3();
const _chainFrom = new THREE.Vector3();
const CHAIN_RANGE2 = 3.2 * 3.2;   // how far chain-lightning can arc
const CHAIN_FRACTION = 0.5;       // arced hit deals half the original damage

export class Game {
  constructor(canvas, uiRoot) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.scene = this.renderer.scene;
    this.world = new World(this.scene);
    this.dropFX = new DropFX(this.scene);
    this.hero = new Hero(this.scene, this.world);

    // Pre-allocated pools (§14): build to the cap once, recycle forever.
    this.enemies = new ObjectPool(LIMITS.maxEnemies, () => new Enemy(this.scene, this.world));
    this.projectiles = new ObjectPool(LIMITS.maxProjectiles, () => new Projectile(this.scene));

    // ── Gear loop (§9.2) ─────────────────────────────────────────────────────
    // Loot persists across runs (Inventory ↔ localStorage); a defense run resets,
    // the stash does not. Equipped perks aggregate into `this.mods`, recomputed
    // only when the loadout changes.
    this.inventory = new Inventory();
    this.mods = this.inventory.getModifiers();
    this.inventory.onChange(() => { this.mods = this.inventory.getModifiers(); });
    this.paused = false;
    this.towers = [];

    // HUD first — it sets uiRoot.innerHTML wholesale, so the InventoryUI (which
    // appends its own nodes) must be built AFTER to survive that reset.
    this.hud = new HUD(uiRoot, {
      onSelectTower: (kind) => { this.selectedTower = kind; },
      onCallWave: () => this._onCallWave(),
      onRestart: () => this.reset(),
      onStash: () => this.invUI.toggle(),
    });
    this.invUI = new InventoryUI(uiRoot, this.inventory, {
      onOpenChange: (open) => { this.paused = open; },
    });
    this.loot = new LootSystem(this.inventory, {
      onDrop: (item, pos) => { this.invUI.showToast(item); this.dropFX.spawn(pos, item.rarity); },
    });
    addEventListener('keydown', (e) => { if (e.code === 'KeyI') this.invUI.toggle(); });

    this.spawnProjectile = this.spawnProjectile.bind(this);
    this._spawnEnemy = this._spawnEnemy.bind(this);

    this.reset();

    this._last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  reset() {
    // Recycle the run's transient state. NOTE: the inventory/stash is deliberately
    // NOT cleared — loot is meta-progression that carries between breaches (§4).
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

  spawnProjectile(origin, target, damage, speed, splash, color, opts) {
    this.projectiles.acquire(origin, target, damage, speed, splash, color, opts);
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
      // AoE (e.g. Stormcaller spire) — damage everything in the blast.
      _splashCenter.copy(p.object.position);
      const r2 = p.splash * p.splash;
      this.enemies.forEachActive((e) => {
        const dx = e.position().x - _splashCenter.x;
        const dz = e.position().z - _splashCenter.z;
        if (dx * dx + dz * dz <= r2) {
          if (e.damage(p.damage)) this._killEnemy(e);
        }
      });
      return;
    }
    if (!p.target || !p.target.active) return;

    _chainFrom.copy(p.object.position);          // capture impact point before any kill
    const killed = p.target.damage(p.damage);
    if (killed) this._killEnemy(p.target);

    // Gear riders only ride hero shots (§4 perks).
    if (p.fromHero) {
      if (p.lifesteal > 0) this.hero.heal(p.damage * p.lifesteal);
      if (p.chain > 0 && Math.random() < p.chain) this._chainArc(p.target, _chainFrom, p.damage);
    }
  }

  // Chain-lightning perk (§4): arc to the nearest *other* enemy for partial damage.
  _chainArc(origin, fromPos, damage) {
    let best = null, bestD = CHAIN_RANGE2;
    this.enemies.forEachActive((e) => {
      if (e === origin) return;
      const dx = e.position().x - fromPos.x;
      const dz = e.position().z - fromPos.z;
      const d = dx * dx + dz * dz;
      if (d <= bestD) { bestD = d; best = e; }
    });
    if (best && best.damage(damage * CHAIN_FRACTION)) this._killEnemy(best);
  }

  _killEnemy(e) {
    this.gold += e.reward * (1 + (this.mods.goldFind || 0)); // §6.1 Gold, +Gold Find perk
    this.loot.enemyKilled(e.typeKey, e.position());          // §4 difficulty-gated drops
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

    if (this.state === 'playing' && !this.paused) this._update(dt);
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

    for (const t of this.towers) t.update(dt, this.enemies, this.spawnProjectile, this.mods);
    this.hero.update(dt, this.input, this.enemies, this.spawnProjectile, this.mods);

    // Projectiles — resolve hits / expiries.
    this.projectiles.forEachActive((p) => {
      const status = p.update(dt);
      if (status === 'hit') { this._resolveHit(p); p.hide(); this.projectiles.release(p); }
      else if (status === 'expired') { p.hide(); this.projectiles.release(p); }
    });

    this.dropFX.update(dt);
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
      this.loot.breachHeld(this.world.ward);   // guaranteed full-clear reward (§4)
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
      relicCount: this.inventory.count(),
    });
  }
}
