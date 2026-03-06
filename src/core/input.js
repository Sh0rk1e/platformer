const BLOCKED_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor() {
    this.held = Object.create(null);
    this.pressed = Object.create(null);

    window.addEventListener('keydown', (e) => {
      if (BLOCKED_KEYS.has(e.code)) e.preventDefault();
      if (!this.held[e.code] && !e.repeat) this.pressed[e.code] = true;
      this.held[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      if (BLOCKED_KEYS.has(e.code)) e.preventDefault();
      this.held[e.code] = false;
    });
  }

  down(code) {
    return !!this.held[code];
  }

  tap(code) {
    return !!this.pressed[code];
  }

  axisX() {
    const right = this.down('ArrowRight') || this.down('KeyD');
    const left = this.down('ArrowLeft') || this.down('KeyA');
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  clearFrame() {
    Object.keys(this.pressed).forEach((k) => delete this.pressed[k]);
  }
}
