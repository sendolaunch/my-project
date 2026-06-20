import * as THREE from 'three';
import { Renderer } from './Renderer.js';
import { Input } from './Input.js';
import { ObjectPool } from './ObjectPool.js';
import { mergeMods } from './mods.js';
import { World } from '../world/World.js';
import { DropFX } from '../world/DropFX.js';
import { Hero } from '../entities/Hero.js';
import { Enemy } from '../entities/Enemy.js';
import { Tower } from '../entities/Tower.js';
import { Projectile } from '../entities/Projectile.js';
import { WaveSystem } from '../systems/WaveSystem.js';
import { LootSystem } from '../systems/LootSystem.js';
import { Inventory } from '../items/Inventory.js';
import { Progression } from '../progression/Progression.js';
import { HUD } from '../ui/HUD.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { SkillTreeUI } from '../ui/SkillTreeUI.js';
import { TOWERS, WARD, ECONOMY, LIMITS, MAPS } from '../config/gameConfig.js';

// The conductor. Owns the world, pools, hero, towers, wave director, the gear
// loop (inventory + loot + drops) and now character progression (XP + skill
// tree) and multiple breaches. Resolves combat and economy; runs the main loop.
// Holds zero rendering detail (Renderer) and zero balancing numbers of its own.

const _splashCenter = new THREE.Vector3();
const _chainFrom = new THREE.Vector3();
const CHAIN_RANGE2 = 3.2 * 3.2;
const CHAIN_FRACTION = 0.5;

export class Game {
  constructor(canvas, uiRoot) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.scene = this.renderer.scene;

    this.mapIndex = 0;
    this.world = new World(this.scene, MAPS[this.mapIndex]);
    this.dropFX = new DropFX(this.scene);
    this.hero = new Hero(this.scene, this.world);

    // Pre-allocated pools (§14): build to the cap once, recycle forever.
    this.enemies = new ObjectPool(LIMITS.maxEnemies, () => new Enemy(this.scene, this.world));
    this.projectiles = new ObjectPool(LIMITS.maxProjectiles, () => new Projectile(this.scene));

    // ── Meta-progression: gear (§4) + skills (§5). Both persist across runs and
    // both feed the same modifier block, recomputed only when something changes.
    this.inventory = new Inventory();
    this.progression = new Progression();
    this._recomputeMods();
    this.inventory.onChange(() => this._recomputeMods());
    this.progression.onChange(() => this._recomputeMods());

    this.paused = false;
    this.towers = [];

    // HUD first — it sets uiRoot.innerHTML wholesale, so the overlay panels
    // (which append their own nodes) must be built AFTER to survive that reset.
    this.hud = new HUD(uiRoot, {
      onSelectTower: (kind) => { this.selectedTower = kind; },
      onCallWave: () => this._onCallWave(),
      onRestart: () => this.reset(),
      onStash: () => this.invUI.toggle(),
      onSkills: () => this.skillUI.toggle(),
      onCycleMap: () => this.cycleMap(),
    });
    this.invUI = new InventoryUI(uiRoot, this.inventory, {
      onOpenChange: (open) => { this.paused = open; if (open) this.skillUI.close(); },
    });
    this.skillUI = new SkillTreeUI(uiRoot, this.progression, {
      onOpenChange: (open) => { this.paused = open; if (open) this.invUI.close(); },
    });
    this.loot = new LootSystem(this.inventory, {
      onDrop: (item, pos) => { this.invUI.showToast(item); this.dropFX.spawn(pos, item.rarity); },
    });
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyI') this.invUI.toggle();
      if (e.code === 'KeyK') this.skillUI.toggle();
    });

    this.spawnProjectile = this.spawnProjectile.bind(this);
    this._spawnEnemy = this._spawnEnemy.bind(this);

    this.reset();

    this._last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // Merge gear + skill modifiers and push the persistent ones (max HP, regen)
  // into the hero. Called whenever loadout or skills change.
  _recomputeMods() {
    this.mods = mergeMods(this.inventory.getModifiers(), this.progression.getModifiers());
    this.hero.setMods(this.mods);
  }

  reset() {
    this.enemies.forEachActive((e) => { e.hide(); this.enemies.release(e); });
    this.projectiles.forEachActive((p) => { p.hide(); this.projectiles.release(p); });
    for (const t of this.towers) this.scene.remove(t.object);
    this.towers = [];
    this.world.occupied.clear();

    // Starting Gold can be raised by the Economy tree (§5 War Chest).
    this.gold = ECONOMY.startingGold + (this.mods.startingGold || 0);
    this.ward = WARD.maxIntegrity;
    this.selectedTower = null;
    this.state = 'playing';          // 'playing' | 'won' | 'lost'

    this.waves = new WaveSystem(this._spawnEnemy);
    this.hero._revive();
    this.hud.clearSelection();
    this.hud.hideResult();
  }

  // ── Breaches (§2: each new map pushes back the Hollow King) ───────────────────
  cycleMap() {
    this.mapIndex = (this.mapIndex + 1) % MAPS.length;
    this.world.dispose();
    this.world = new World(this.scene, MAPS[this.mapIndex]);
    this.hero.setWorld(this.world);
    for (const e of this.enemies.members) e.world = this.world; // pooled enemies follow the new path
    this.reset();
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
    if (this.gold < def.cost) this.hud.clearSelection();
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
      return;
    }
    if (!p.target || !p.target.active) return;

    _chainFrom.copy(p.object.position);
    const killed = p.target.damage(p.damage);
    if (killed) this._killEnemy(p.target);

    if (p.fromHero) {
      if (p.lifesteal > 0) this.hero.heal(p.damage * p.lifesteal);
      if (p.chain > 0 && Math.random() < p.chain) this._chainArc(p.target, _chainFrom, p.damage);
    }
  }

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
    this.gold += e.reward * (1 + (this.mods.goldFind || 0));         // §6.1 + §5 Plunder
    const gained = this.progression.addXp(e.def.xp || 0);           // §5 XP → levels
    if (gained > 0) this.hud.flashLevelUp(this.progression.level);
    this.loot.enemyKilled(e.typeKey, e.position(), this.mods.magicFind || 0); // §4 drops + §5 luck
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
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;

    if (this.state === 'playing' && !this.paused) this._update(dt);
    this.renderer.render();
    requestAnimationFrame(this._loop);
  }

  _update(dt) {
    for (const c of this.input.drainClicks()) {
      if (c.button === 0) this._tryPlace(c.x, c.y);
      else this.hud.clearSelection();
    }

    if (this.selectedTower && this.input.pointerOnScreen) {
      const g = this.renderer.pointerToGround(this.input.pointerNDC.x, this.input.pointerNDC.y);
      if (g) { const { col, row } = this.world.worldToGrid(g.x, g.z); this.world.showHover(col, row); }
      else this.world.hideHover();
    } else {
      this.world.hideHover();
    }

    this.waves.update(dt);

    // Ward slowly mends if the Support tree invests in it (§5).
    if (this.mods.wardRegen > 0 && this.ward < WARD.maxIntegrity) {
      this.ward = Math.min(WARD.maxIntegrity, this.ward + this.mods.wardRegen * dt);
    }

    this.enemies.forEachActive((e) => {
      if (e.update(dt) === 'reached') {
        this.ward -= e.wardDamage;
        e.hide();
        this.enemies.release(e);
      }
    });

    for (const t of this.towers) t.update(dt, this.enemies, this.spawnProjectile, this.mods);
    this.hero.update(dt, this.input, this.enemies, this.spawnProjectile, this.mods);

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
      this.loot.breachHeld(this.world.ward, this.mods.magicFind || 0); // full-clear reward (§4)
      this.hud.showResult(true);
    }
  }

  _pushHud() {
    this.hud.update({
      gold: Math.floor(this.gold),
      ward: this.ward,
      heroHp: this.hero.hp,
      heroMaxHp: this.hero.maxHp,
      wave: this.waves.currentWaveNumber,
      totalWaves: this.waves.totalWaves,
      started: this.waves.started,
      inCooldown: this.waves.inCooldown,
      playing: this.state === 'playing',
      relicCount: this.inventory.count(),
      mapName: this.world.name,
      level: this.progression.level,
      xp: this.progression.xp,
      xpNext: this.progression.xpToNext(),
      skillPoints: this.progression.unspent,
    });
  }
}
