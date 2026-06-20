import { BRANCHES, NODES_BY_BRANCH } from '../progression/skillTree.js';
import { css } from '../config/palette.js';

// The Wardlines — the §5 skill-tree panel. View + intent: it renders progression
// state and reports point-spends through the Progression model. Four branches
// (Tower / Hero / Support / Economy) shown as short unlock chains. Pauses the run
// while open (Game wires onOpenChange), same as the stash.

export class SkillTreeUI {
  constructor(root, progression, { onOpenChange } = {}) {
    this.prog = progression;
    this.onOpenChange = onOpenChange || (() => {});
    this.isOpen = false;

    this.el = document.createElement('div');
    this.el.className = 'skilltree';
    root.appendChild(this.el);

    progression.onChange(() => { if (this.isOpen) this.refresh(); });
    this.refresh();
  }

  toggle() { this.isOpen ? this.close() : this.open(); }
  open() { this.isOpen = true; this.el.classList.add('show'); this.refresh(); this.onOpenChange(true); }
  close() { this.isOpen = false; this.el.classList.remove('show'); this.onOpenChange(false); }

  _nodeHtml(node, color) {
    const rank = this.prog.rankOf(node.id);
    const unlocked = this.prog.isUnlocked(node.id);
    const maxed = rank >= node.maxRank;
    const can = this.prog.canRank(node.id);
    let state = 'locked';
    if (maxed) state = 'maxed'; else if (unlocked) state = 'open';
    const pips = Array.from({ length: node.maxRank }, (_, i) =>
      `<span class="pip ${i < rank ? 'on' : ''}"></span>`).join('');
    return `
      <div class="node ${state}" style="--bc:${color}">
        <div class="node-head">
          <span class="node-name">${node.name}</span>
          <span class="node-rank">${rank}/${node.maxRank}</span>
        </div>
        <div class="pips">${pips}</div>
        <div class="node-desc">${node.desc}</div>
        ${can ? `<button class="node-buy" data-node="${node.id}">Rank up ▸</button>`
              : (maxed ? '<div class="node-tag">Maxed</div>'
                       : (!unlocked ? '<div class="node-tag">Locked</div>' : '<div class="node-tag">No points</div>'))}
      </div>`;
  }

  refresh() {
    const p = this.prog;
    const xpNext = p.xpToNext();
    const xpPct = Math.min(100, (p.xp / xpNext) * 100);

    const cols = BRANCHES.map((b) => {
      const color = css(b.color);
      const nodes = NODES_BY_BRANCH[b.id].map((n) => this._nodeHtml(n, color)).join('');
      return `
        <section class="branch" style="--bc:${color}">
          <h3>${b.label}</h3>
          <div class="branch-tag">${b.tag}</div>
          <div class="nodes">${nodes}</div>
        </section>`;
    }).join('');

    this.el.innerHTML = `
      <div class="skill-head">
        <div class="lvl">
          <div class="lvl-num">Level <b>${p.level}</b></div>
          <div class="xpbar"><div class="xpfill" style="width:${xpPct}%"></div></div>
          <div class="xp-text">${p.xp} / ${xpNext} XP</div>
        </div>
        <div class="points ${p.unspent > 0 ? 'has' : ''}">${p.unspent} skill point${p.unspent === 1 ? '' : 's'}</div>
        <div class="skill-actions">
          <button class="respec" data-act="respec">Respec</button>
          <button class="skill-close" data-act="close">Close (K)</button>
        </div>
      </div>
      <div class="branches">${cols}</div>`;

    this.el.querySelectorAll('[data-node]').forEach((btn) =>
      btn.addEventListener('click', () => this.prog.rank(btn.dataset.node)));
    this.el.querySelector('[data-act="respec"]').addEventListener('click', () => this.prog.respec());
    this.el.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
  }
}
