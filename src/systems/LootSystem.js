import { rollDrop } from '../items/ItemFactory.js';
import { DROP_SOURCES } from '../items/itemDefs.js';

// Bridges combat events to gear drops. The §4 anti-farm rule lives in the drop
// tables (itemDefs); this system just fires them at the right moment: an enemy
// dies, or the whole breach is held (full clear). Every dropped item lands in
// the Inventory and is announced via onDrop (toast + in-world spark).

export class LootSystem {
  constructor(inventory, { onDrop } = {}) {
    this.inventory = inventory;
    this.onDrop = onDrop || (() => {});
  }

  /** Roll drops for a slain enemy at its position. Trash rarely drops; bosses always do. */
  enemyKilled(typeKey, worldPos) {
    if (!DROP_SOURCES[typeKey]) return;     // not every enemy type is on a table
    for (const item of rollDrop(typeKey)) {
      this.inventory.add(item);
      this.onDrop(item, worldPos);
    }
  }

  /** Guaranteed high-tier reward for surviving every wave (§4 "full clears"). */
  breachHeld(worldPos) {
    for (const item of rollDrop('clear')) {
      this.inventory.add(item);
      this.onDrop(item, worldPos);
    }
  }
}
