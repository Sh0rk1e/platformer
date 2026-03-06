import { lerp } from '../core/utils.js';

export class Renderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.settings = settings;
    this.cam = { x: 0, y: 0, shake: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  applySettings(settings) {
    this.settings = settings;
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  updateCamera(player, dt, reducedShake = false) {
    const deadX = this.width * 0.2;
    const targetX = player.pos.x - this.width * 0.5 + player.vel.x * 16;
    const targetY = player.pos.y - this.height * 0.55 + player.vel.y * 8;

    if (Math.abs(targetX - this.cam.x) > deadX) this.cam.x = lerp(this.cam.x, targetX, 0.08 * dt);
    else this.cam.x = lerp(this.cam.x, targetX, 0.02 * dt);
    this.cam.y = lerp(this.cam.y, targetY, 0.07 * dt);

    if (reducedShake) this.cam.shake *= 0.75;
    else this.cam.shake *= 0.9;
  }

  pulseShake(value) {
    this.cam.shake = Math.max(this.cam.shake, value);
  }

  beginFrame() {
    const { ctx, width, height } = this;
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, height);

    const stars = [
      { c: '#0a0a1a', s: 0.05, gap: 460 },
      { c: '#11112a', s: 0.13, gap: 300 },
      { c: '#17173a', s: 0.26, gap: 170 }
    ];
    for (const l of stars) {
      ctx.fillStyle = l.c;
      const ox = -(this.cam.x * l.s) % l.gap;
      const oy = -(this.cam.y * l.s) % l.gap;
      for (let x = ox - l.gap; x < width + l.gap; x += l.gap) {
        for (let y = oy - l.gap; y < height + l.gap; y += l.gap) {
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.strokeStyle = 'rgba(0,242,255,0.05)';
    ctx.lineWidth = 1;
    const grid = 120;
    const gx = -this.cam.x % grid;
    const gy = -this.cam.y % grid;
    ctx.beginPath();
    for (let x = gx; x < width; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = gy; y < height; y += grid) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();

    ctx.save();
    const intensity = this.cam.shake;
    if (intensity > 0.1) {
      ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
    }
  }

  endFrame() {
    this.ctx.restore();
  }

  drawWorld(level, player, enemies, projectiles, effects, settings) {
    const { ctx } = this;
    const cx = this.cam.x;
    const cy = this.cam.y;

    for (const p of level.platforms) {
      const color = p.color || '#222';
      ctx.shadowBlur = color === '#1a1a24' ? 0 : 15;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillRect(p.x - cx, p.y - cy, p.w, p.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.strokeRect(p.x - cx, p.y - cy, p.w, p.h);
    }

    const hazardColor = settings.highContrastHazards ? '#ff3300' : '#ff0077';
    ctx.shadowBlur = 18;
    ctx.shadowColor = hazardColor;
    ctx.fillStyle = hazardColor;
    for (const h of level.hazards) {
      const steps = Math.ceil(h.w / 20);
      const stepW = h.w / steps;
      for (let i = 0; i < steps; i++) {
        ctx.beginPath();
        ctx.moveTo(h.x + i * stepW - cx, h.y + h.h - cy);
        ctx.lineTo(h.x + (i + 0.5) * stepW - cx, h.y - cy);
        ctx.lineTo(h.x + (i + 1) * stepW - cx, h.y + h.h - cy);
        ctx.fill();
      }
    }

    for (const c of level.collectibles) {
      if (c.collected) continue;
      const pulse = 8 + Math.sin(performance.now() / 120) * 5;
      ctx.shadowBlur = pulse;
      ctx.shadowColor = '#00ff88';
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(c.x - cx, c.y - cy, c.w, c.h);
    }

    for (const cp of level.checkpoints) {
      ctx.shadowBlur = cp.active ? 18 : 6;
      ctx.shadowColor = cp.active ? '#00ff88' : '#00f2ff';
      ctx.fillStyle = cp.active ? '#00ff88' : '#00f2ff';
      ctx.fillRect(cp.x - cx, cp.y - cy, cp.w, cp.h);
    }

    ctx.shadowBlur = 12;
    for (const e of enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = e.type === 'shooter' ? '#ffd166' : (e.type === 'jumper' ? '#f6a6ff' : '#ff8b8b');
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillRect(e.x - cx, e.y - cy, e.w, e.h);
    }

    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffd166';
    ctx.fillStyle = '#ffd166';
    for (const p of projectiles) ctx.fillRect(p.x - cx, p.y - cy, p.w, p.h);

    ctx.shadowColor = '#00ff88';
    ctx.fillStyle = '#00ff88';
    for (const g of level.goals) {
      const pulse = Math.sin(performance.now() / 220) * 12;
      ctx.shadowBlur = 20 + pulse;
      ctx.fillRect(g.x - cx, g.y - cy, g.w, g.h);
    }

    ctx.shadowBlur = player.isDashing ? 26 : 14;
    ctx.shadowColor = player.iFrames > 0 ? '#ffbbd8' : '#00f2ff';
    ctx.fillStyle = player.iFrames > 0 ? '#ffbbd8' : '#00f2ff';
    ctx.fillRect(player.pos.x - cx, player.pos.y - cy, player.w, player.h);

    ctx.shadowBlur = 0;
    for (const p of effects.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - cx, p.y - cy, p.size, p.size);
      ctx.globalAlpha = 1;
    }

    if (effects.flash > 0) {
      ctx.fillStyle = `rgba(255, 70, 120, ${Math.min(0.35, effects.flash)})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }
}
