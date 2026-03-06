import { overlaps } from '../core/utils.js';

const baseEnemy = (cfg) => ({
  id: cfg.id || `enemy-${Math.random().toString(16).slice(2)}`,
  type: cfg.type || 'patroller',
  x: cfg.x,
  y: cfg.y,
  spawnX: cfg.x,
  spawnY: cfg.y,
  w: cfg.w || 36,
  h: cfg.h || 36,
  vx: cfg.vx || 2,
  vy: 0,
  alive: true,
  cooldown: 0,
  dir: cfg.dir || 1,
  range: cfg.range || 200,
  jumpTimer: 0,
  shotTimer: 0
});

export const spawnEnemies = (defs) => defs.map(baseEnemy);

export const updateEnemies = (enemies, platforms, player, dt, projectilesOut) => {
  for (const e of enemies) {
    if (!e.alive) continue;

    if (e.type === 'patroller') {
      e.x += e.vx * e.dir * dt;
      if (Math.abs(e.x - e.spawnX) > e.range) e.dir *= -1;
    }

    if (e.type === 'jumper') {
      e.jumpTimer -= dt;
      if (e.jumpTimer <= 0) {
        e.vy = -9;
        e.jumpTimer = 70;
      }
      e.vy += 0.45 * dt;
      e.y += e.vy * dt;
      for (const p of platforms) {
        if (overlaps({ x: e.x, y: e.y, w: e.w, h: e.h }, p) && e.vy > 0) {
          e.y = p.y - e.h;
          e.vy = 0;
        }
      }
      e.x += 1.8 * e.dir * dt;
      if (Math.abs(e.x - e.spawnX) > e.range) e.dir *= -1;
    }

    if (e.type === 'shooter') {
      e.shotTimer -= dt;
      if (e.shotTimer <= 0) {
        const toward = player.pos.x + player.w * 0.5 > e.x ? 1 : -1;
        projectilesOut.push({ x: e.x + e.w * 0.5, y: e.y + 12, w: 10, h: 6, vx: toward * 7, vy: 0, alive: true });
        e.shotTimer = 95;
      }
    }
  }
};

export const updateProjectiles = (projectiles, dt, boundsW = 6000) => {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (!p.alive) {
      projectiles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    if (p.x < -200 || p.x > boundsW) projectiles.splice(i, 1);
  }
};
