import { TOWERS, WARD } from '../config/gameConfig.js';

// DOM HUD over the canvas. Pure view + input: it renders state the Game pushes in
// via update(), and reports intent (tower selected, wave called, restart, stash,
// skills, breach cycle) through callbacks. No game logic lives here.

export class HUD {
  constructor(root, { onSelectTower, onCallWave, onRestart, onStash, onSkills, onCycleMap }) {
    this.onSelectTower = onSelectTower;
    this.onCallWave = onCallWave;
    this.onRestart = onRestart;
    this.onStash = onStash || (() => {});
    this.onSkills = onSkills || (() => {});
    this.onCycleMap = onCycleMap || (() => {});
    this.selected = null;
    this.buttons = {};

    root.innerHTML = `
      <div class="hud-top">
        <div class="brand-col">
          <div class="brand">
            <div class="wordmark">OSS<b>A</b>RA</div>
            <div class="tagline">Hold the breach. Loot the dead.</div>
          </div>
          <div class="char">
            <span class="lvl-chip">LVL <b data-level>1</b></span>
            <div class="xpbar mini"><div class="xpfill" data-xp></div></div>
          </div>
        </div>
        <div class="wave-box">
          <div class="label">Breach</div>
          <button class="breach-sel" data-breach>◂ <span data-mapname>—</span> ▸</button>
          <div class="value" data-wave>—</div>
          <button class="call-wave hidden" data-callwave>Call wave ▸</button>
        </div>
        <div class="stats">
          <div class="stat-row gold"><span class="k">Gold</span><span class="v" data-gold>0</span></div>
          <div class="stat-row"><span class="k">HP</span><div class="hp-bar"><div class="hp-fill" data-hp></div></div></div>
          <div class="stat-row"><span class="k">Ward</span><div class="ward-bar"><div class="ward-fill" data-ward></div></div></div>
        </div>
      </div>

      <div class="hint" data-hint>Select a defense, then click a tile to place it · WASD move the Warden</div>

      <div class="corner-btns">
        <button class="hud-btn" data-stash>▣ <b>Stash</b> · <span data-relics>0</span> relics <span class="key">I</span></button>
        <button class="hud-btn" data-skills>✦ <b>Wardlines</b> <span class="pt-badge" data-points>0</span> <span class="key">K</span></button>
      </div>

      <div class="build-bar" data-buildbar></div>

      <div class="overlay" data-overlay>
        <h1 data-result></h1>
        <p data-resultsub></p>
        <button data-restart>Hold again</button>
      </div>`;

    this.$wave    = root.querySelector('[data-wave]');
    this.$gold    = root.querySelector('[data-gold]');
    this.$ward    = root.querySelector('[data-ward]');
    this.$hp      = root.querySelector('[data-hp]');
    this.$level   = root.querySelector('[data-level]');
    this.$xp      = root.querySelector('[data-xp]');
    this.$points  = root.querySelector('[data-points]');
    this.$mapName = root.querySelector('[data-mapname]');
    this.$callBtn = root.querySelector('[data-callwave]');
    this.$buildbar= root.querySelector('[data-buildbar]');
    this.$overlay = root.querySelector('[data-overlay]');
    this.$result  = root.querySelector('[data-result]');
    this.$resultSub = root.querySelector('[data-resultsub]');
    this.$relics = root.querySelector('[data-relics]');

    this.$callBtn.addEventListener('click', () => this.onCallWave());
    root.querySelector('[data-restart]').addEventListener('click', () => this.onRestart());
    root.querySelector('[data-stash]').addEventListener('click', () => this.onStash());
    root.querySelector('[data-skills]').addEventListener('click', () => this.onSkills());
    root.querySelector('[data-breach]').addEventListener('click', () => this.onCycleMap());

    // Build one button per tower, in config order. Keys 1..N select them.
    let i = 1;
    for (const [kind, def] of Object.entries(TOWERS)) {
      const btn = document.createElement('button');
      btn.className = 'build-btn';
      btn.dataset.kind = kind;
      btn.innerHTML = `
        <span class="key">${i}</span>
        <div class="name">${def.name}</div>
        <div class="order">${def.order}</div>
        <div class="cost">${def.cost}</div>`;
      btn.addEventListener('click', () => this.select(kind));
      this.$buildbar.appendChild(btn);
      this.buttons[kind] = btn;
      i++;
    }
    addEventListener('keydown', (e) => {
      const idx = Number(e.key) - 1;
      const kinds = Object.keys(TOWERS);
      if (idx >= 0 && idx < kinds.length) this.select(kinds[idx]);
      if (e.code === 'Escape') this.select(null);
    });
  }

  select(kind) {
    this.selected = (this.selected === kind) ? null : kind; // toggle off on re-click
    for (const [k, btn] of Object.entries(this.buttons)) {
      btn.classList.toggle('selected', k === this.selected);
    }
    this.onSelectTower(this.selected);
  }

  clearSelection() { this.select(null); }

  update(state) {
    this.$gold.textContent = state.gold;
    if (state.relicCount !== undefined) this.$relics.textContent = state.relicCount;
    if (state.mapName) this.$mapName.textContent = state.mapName;

    // Progression (§5).
    this.$level.textContent = state.level;
    this.$xp.style.width = `${Math.min(100, (state.xp / state.xpNext) * 100)}%`;
    this.$points.textContent = state.skillPoints;
    this.$points.classList.toggle('has', state.skillPoints > 0);

    const wardPct = Math.max(0, state.ward / WARD.maxIntegrity) * 100;
    this.$ward.style.width = `${wardPct}%`;
    this.$ward.classList.toggle('low', wardPct <= 30);

    const hpPct = Math.max(0, state.heroHp / state.heroMaxHp) * 100;
    this.$hp.style.width = `${hpPct}%`;
    this.$hp.classList.toggle('low', hpPct <= 30);

    if (!state.started) {
      this.$wave.textContent = 'Seals holding';
      this.$callBtn.classList.remove('hidden');
      this.$callBtn.textContent = 'Begin defense ▸';
    } else if (state.inCooldown) {
      this.$wave.textContent = `Wave ${state.wave} / ${state.totalWaves} cleared`;
      this.$callBtn.classList.remove('hidden');
      this.$callBtn.textContent = 'Call next wave ▸';
    } else {
      this.$wave.textContent = `Wave ${state.wave} / ${state.totalWaves}`;
      this.$callBtn.classList.add('hidden');
    }

    // The breach can be changed before a run, between waves, or after one ends —
    // just not mid-wave (a switch restarts the hold).
    this.$mapName.parentElement.classList.toggle('disabled', state.playing && state.started && !state.inCooldown);

    // Grey out defenses the player can't currently afford.
    for (const [kind, def] of Object.entries(TOWERS)) {
      this.buttons[kind].classList.toggle('unaffordable', state.gold < def.cost);
    }
  }

  showResult(win) {
    this.$overlay.classList.add('show', win ? 'win' : 'lose');
    this.$overlay.classList.remove(win ? 'lose' : 'win');
    this.$result.textContent = win ? 'Breach held' : 'Ward shattered';
    this.$resultSub.textContent = win
      ? 'The seal holds — for now. The Hollow King will reach through again.'
      : 'The dead poured through. The line breaks and the dark floods in.';
  }

  hideResult() {
    this.$overlay.classList.remove('show', 'win', 'lose');
  }

  // Brief center-screen flash on level-up (§5 feedback).
  flashLevelUp(level) {
    const el = document.createElement('div');
    el.className = 'levelup';
    el.innerHTML = `Level ${level} <span>· skill point earned</span>`;
    this.$overlay.parentElement.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 1800);
  }
}
