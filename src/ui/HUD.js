import { TOWERS, WARD } from '../config/gameConfig.js';

// DOM HUD over the canvas. Pure view + input: it renders state the Game pushes in
// via update(), and reports intent (tower selected, wave called, restart) through
// callbacks. No game logic lives here.

export class HUD {
  constructor(root, { onSelectTower, onCallWave, onRestart }) {
    this.onSelectTower = onSelectTower;
    this.onCallWave = onCallWave;
    this.onRestart = onRestart;
    this.selected = null;
    this.buttons = {};

    root.innerHTML = `
      <div class="hud-top">
        <div class="brand">
          <div class="wordmark">OSS<b>A</b>RA</div>
          <div class="tagline">Hold the breach. Loot the dead.</div>
        </div>
        <div class="wave-box">
          <div class="label">Breach</div>
          <div class="value" data-wave>—</div>
          <button class="call-wave hidden" data-callwave>Call wave ▸</button>
        </div>
        <div class="stats">
          <div class="stat-row gold"><span class="k">Gold</span><span class="v" data-gold>0</span></div>
          <div class="stat-row"><span class="k">Ward</span><div class="ward-bar"><div class="ward-fill" data-ward></div></div></div>
        </div>
      </div>

      <div class="hint" data-hint>Select a defense, then click a tile to place it · WASD move the Warden</div>

      <div class="build-bar" data-buildbar></div>

      <div class="overlay" data-overlay>
        <h1 data-result></h1>
        <p data-resultsub></p>
        <button data-restart>Hold again</button>
      </div>`;

    this.$wave    = root.querySelector('[data-wave]');
    this.$gold    = root.querySelector('[data-gold]');
    this.$ward    = root.querySelector('[data-ward]');
    this.$callBtn = root.querySelector('[data-callwave]');
    this.$buildbar= root.querySelector('[data-buildbar]');
    this.$overlay = root.querySelector('[data-overlay]');
    this.$result  = root.querySelector('[data-result]');
    this.$resultSub = root.querySelector('[data-resultsub]');

    this.$callBtn.addEventListener('click', () => this.onCallWave());
    root.querySelector('[data-restart]').addEventListener('click', () => this.onRestart());

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

    const pct = Math.max(0, state.ward / WARD.maxIntegrity) * 100;
    this.$ward.style.width = `${pct}%`;
    this.$ward.classList.toggle('low', pct <= 30);

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
}
