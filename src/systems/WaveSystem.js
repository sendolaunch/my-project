import { WAVES } from '../config/gameConfig.js';

// Drives the escalating waves (§9.1). Each wave drips its spawn groups, then a
// `gap` cooldown precedes the next wave (the player can call it early). The
// Game decides victory: all waves spawned AND the board cleared.

const PHASE = { IDLE: 'idle', SPAWNING: 'spawning', COOLDOWN: 'cooldown', DONE: 'done' };

export class WaveSystem {
  constructor(onSpawn) {
    this.onSpawn = onSpawn;          // (typeKey) => void
    this.waveIndex = -1;
    this.totalWaves = WAVES.length;
    this.phase = PHASE.IDLE;
    this.timeToNext = 0;             // cooldown countdown (seconds)
    this.groups = [];
  }

  start() { this._begin(0); }

  _begin(i) {
    this.waveIndex = i;
    this.phase = PHASE.SPAWNING;
    this.groups = WAVES[i].groups.map((g) => ({
      typeKey: g.type,
      remaining: g.count,
      interval: g.interval,
      timer: g.delay || 0,           // first spawn after its delay
    }));
  }

  /** Skip the lull and pull the next wave now (HUD "Call wave" button / Space). */
  startEarly() {
    if (this.phase === PHASE.COOLDOWN) this._begin(this.waveIndex + 1);
  }

  update(dt) {
    if (this.phase === PHASE.SPAWNING) {
      let anyLeft = false;
      for (const g of this.groups) {
        if (g.remaining <= 0) continue;
        anyLeft = true;
        g.timer -= dt;
        if (g.timer <= 0) {
          this.onSpawn(g.typeKey);
          g.remaining--;
          g.timer = g.interval;
        }
      }
      if (!anyLeft) {
        if (this.waveIndex + 1 < this.totalWaves) {
          this.phase = PHASE.COOLDOWN;
          this.timeToNext = WAVES[this.waveIndex + 1].gap;
        } else {
          this.phase = PHASE.DONE;   // last wave fully spawned
        }
      }
    } else if (this.phase === PHASE.COOLDOWN) {
      this.timeToNext -= dt;
      if (this.timeToNext <= 0) this._begin(this.waveIndex + 1);
    }
  }

  // ── HUD getters ──
  get currentWaveNumber() { return Math.max(0, this.waveIndex + 1); }
  get inCooldown() { return this.phase === PHASE.COOLDOWN; }
  get allWavesSpawned() { return this.phase === PHASE.DONE; }
  get started() { return this.phase !== PHASE.IDLE; }
}
