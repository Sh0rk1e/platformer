import { rectCenter } from '../core/utils.js';

export class Particle {
  constructor(x, y, color, spread = 8) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * spread;
    this.vy = (Math.random() - 0.5) * spread;
    this.life = 1;
    this.size = Math.random() * 4 + 2;
    this.color = color;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= 0.04 * dt;
    this.size *= Math.pow(0.95, dt);
  }
}

export class Effects {
  constructor() {
    this.particles = [];
    this.flash = 0;
  }

  burst(rect, color, count = 10) {
    const c = rectCenter(rect);
    for (let i = 0; i < count; i++) this.particles.push(new Particle(c.x, c.y, color));
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - 0.08 * dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].life <= 0 || this.particles[i].size < 0.2) this.particles.splice(i, 1);
    }
  }
}
