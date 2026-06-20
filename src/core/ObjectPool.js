// Object pool — the backbone of the §14 performance budget. Enemies and
// projectiles churn constantly; allocating/GC-ing them per spawn is what makes
// browser games stutter. Instead we allocate a fixed array once and recycle.
//
// Members must implement:
//   reset(...args)  -> initialize for reuse (called on acquire)
//   active: boolean -> pool ownership flag (managed here, read by systems)
//
// The pool never grows past `size`; acquire() returns null when full, and the
// caller simply skips the spawn. That is the cap, by design.

export class ObjectPool {
  /**
   * @param {number} size       fixed capacity
   * @param {() => object} factory  builds one member (called `size` times up front)
   */
  constructor(size, factory) {
    this.size = size;
    this.members = new Array(size);
    for (let i = 0; i < size; i++) {
      const m = factory(i);
      m.active = false;
      this.members[i] = m;
    }
  }

  /** Grab an inactive member and reset it. Returns null if the pool is full. */
  acquire(...args) {
    for (let i = 0; i < this.size; i++) {
      const m = this.members[i];
      if (!m.active) {
        m.active = true;
        m.reset(...args);
        return m;
      }
    }
    return null; // full — caller skips this spawn (the entity cap)
  }

  /** Mark a member inactive so acquire() can reuse it. */
  release(m) {
    m.active = false;
  }

  /** Iterate only the live members; cheap inner-loop helper for systems. */
  forEachActive(fn) {
    for (let i = 0; i < this.size; i++) {
      const m = this.members[i];
      if (m.active) fn(m, i);
    }
  }

  countActive() {
    let n = 0;
    for (let i = 0; i < this.size; i++) if (this.members[i].active) n++;
    return n;
  }
}
