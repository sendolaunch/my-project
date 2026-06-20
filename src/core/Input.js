// Keyboard + pointer state. Movement is polled (held keys), placement is an
// event queue (discrete clicks). Pointer position is kept in NDC so the
// Renderer can raycast it onto the board.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pointerNDC = { x: 0, y: 0 };
    this.pointerOnScreen = false;
    this.clicks = [];        // drained each frame by the Game
    this._canvas = canvas;

    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      // Digit keys 1..4 select build slots; let them through but don't scroll.
      if (['Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    const updatePointer = (e) => {
      this.pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.pointerOnScreen = true;
    };
    canvas.addEventListener('pointermove', updatePointer);
    canvas.addEventListener('pointerdown', (e) => {
      updatePointer(e);
      this.clicks.push({ x: this.pointerNDC.x, y: this.pointerNDC.y, button: e.button });
    });
    canvas.addEventListener('pointerleave', () => { this.pointerOnScreen = false; });
  }

  held(code) { return this.keys.has(code); }

  // WASD / arrows → world-axis movement vector (un-normalized; caller normalizes).
  moveVector() {
    let x = 0, z = 0;
    if (this.held('KeyW') || this.held('ArrowUp'))    z -= 1;
    if (this.held('KeyS') || this.held('ArrowDown'))  z += 1;
    if (this.held('KeyA') || this.held('ArrowLeft'))  x -= 1;
    if (this.held('KeyD') || this.held('ArrowRight')) x += 1;
    return { x, z };
  }

  drainClicks() {
    const c = this.clicks;
    this.clicks = [];
    return c;
  }
}
