import { SLOTS, RARITY_BY_KEY, MODIFIERS } from '../items/itemDefs.js';
import { RARITY_COLOR, css } from '../config/palette.js';

// The Stash — inspect recovered relics, equip them into the nine slots, see the
// aggregated bonuses. View + intent only; all ownership lives in Inventory. The
// panel pauses the game while open (the Game wires that via onOpenChange).
//
// God rolls (§4) are surfaced front and center: every item shows a quality meter,
// and a 90%+ roll earns a badge — that's the thing players hunt and trade for.

const SLOT_LABEL = {
  head: 'Head', chest: 'Chest', legs: 'Legs', feet: 'Feet', hands: 'Hands',
  cape: 'Cape', pet: 'Pet', weapon: 'Weapon', accessory: 'Accessory',
};

export class InventoryUI {
  constructor(root, inventory, { onOpenChange } = {}) {
    this.inventory = inventory;
    this.onOpenChange = onOpenChange || (() => {});
    this.isOpen = false;
    this.selectedId = null;

    this.el = document.createElement('div');
    this.el.className = 'stash';
    root.appendChild(this.el);

    this.toasts = document.createElement('div');
    this.toasts.className = 'toast-stack';
    root.appendChild(this.toasts);

    inventory.onChange(() => { if (this.isOpen) this.refresh(); });
    this.refresh();
  }

  toggle() { this.isOpen ? this.close() : this.open(); }
  open() { this.isOpen = true; this.el.classList.add('show'); this.refresh(); this.onOpenChange(true); }
  close() { this.isOpen = false; this.el.classList.remove('show'); this.onOpenChange(false); }

  _rarityLabel(key) { return RARITY_BY_KEY[key]?.label || key; }
  _qpct(item) { return Math.round((item.quality || 0) * 100); }

  _perkHtml(p) {
    if (p.cosmetic) return `<li class="perk cosmetic">${p.label} <span class="tag">flex</span></li>`;
    return `<li class="perk">${p.label} <b>+${p.value}%</b></li>`;
  }

  _cardHtml(item, equipped = false) {
    const c = css(RARITY_COLOR[item.rarity]);
    const q = this._qpct(item);
    const god = item.quality >= 0.9 ? '<span class="god">GOD ROLL</span>' : '';
    const name = item.slot === 'weapon' && item.weaponKind ? item.name : item.name;
    return `
      <button class="relic ${this.selectedId === item.id ? 'sel' : ''}" data-id="${item.id}"
              data-act="${equipped ? 'unequip' : 'equip'}" style="--rc:${c}">
        <div class="relic-top">
          <span class="relic-name">${name}</span>${god}
        </div>
        <div class="relic-sub">${this._rarityLabel(item.rarity)} · ${SLOT_LABEL[item.slot]}</div>
        <div class="qbar"><div class="qfill" style="width:${q}%"></div><span>${q}%</span></div>
        <ul class="perks">${item.perks.map((p) => this._perkHtml(p)).join('')}</ul>
        <div class="relic-act">${equipped ? 'Unequip ▸' : 'Equip ▸'}</div>
      </button>`;
  }

  _modsSummaryHtml() {
    const mods = this.inventory.getModifiers();
    const rows = [];
    for (const [key, def] of Object.entries(MODIFIERS)) {
      if (key === 'cosmetic') continue;
      const v = mods[key] || 0;
      if (v <= 0) continue;
      rows.push(`<li>${def.label.replace('+% ', '')} <b>+${Math.round(v * 100)}%</b></li>`);
    }
    if (mods.cosmeticCount) rows.push(`<li class="cosmetic">Cosmetic flexes <b>${mods.cosmeticCount}</b></li>`);
    return rows.length ? `<ul>${rows.join('')}</ul>` : '<p class="empty">No bonuses — equip relics to power up.</p>';
  }

  refresh() {
    const equipped = this.inventory.equippedItems();
    const backpack = this.inventory.backpack();

    const slotCells = SLOTS.map((s) => {
      const item = equipped[s];
      if (!item) return `<div class="slot empty"><span class="slot-name">${SLOT_LABEL[s]}</span><span class="slot-hint">— empty —</span></div>`;
      return `<div class="slot filled">${this._cardHtml(item, true)}</div>`;
    }).join('');

    const relics = backpack.length
      ? backpack.map((i) => this._cardHtml(i, false)).join('')
      : '<p class="empty">No loose relics. Hold a breach and slay the dead to recover gear.</p>';

    this.el.innerHTML = `
      <div class="stash-head">
        <h2>Stash <span>· ${this.inventory.count()} relics recovered</span></h2>
        <button class="stash-close" data-act="close">Close (I)</button>
      </div>
      <div class="stash-body">
        <section class="loadout">
          <h3>Loadout</h3>
          <div class="slots">${slotCells}</div>
          <h3>Active bonuses</h3>
          <div class="mods">${this._modsSummaryHtml()}</div>
        </section>
        <section class="backpack">
          <h3>Recovered relics</h3>
          <div class="relics">${relics}</div>
        </section>
      </div>`;

    this.el.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'close') return this.close();
        const id = btn.dataset.id;
        if (act === 'equip') this.inventory.equip(id);
        else if (act === 'unequip') {
          const item = this.inventory.get(id);
          if (item) this.inventory.unequip(item.slot);
        }
      });
    });
  }

  // Transient drop notification, rarity-colored. Stacks, auto-dismisses.
  showToast(item) {
    const c = css(RARITY_COLOR[item.rarity]);
    const god = item.quality >= 0.9 ? ' ★' : '';
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.setProperty('--rc', c);
    t.innerHTML = `<span class="t-label">Recovered</span><span class="t-name">${item.name}${god}</span>
                   <span class="t-rarity">${this._rarityLabel(item.rarity)}</span>`;
    this.toasts.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 350); }, 3800);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }
}
