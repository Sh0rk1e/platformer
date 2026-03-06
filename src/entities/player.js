import { clamp, overlaps } from '../core/utils.js';

export class Player {
  constructor(spawn) {
    this.pos = { x: spawn.x, y: spawn.y };
    this.vel = { x: 0, y: 0 };
    this.w = 32;
    this.h = 46;

    this.accel = 0.8;
    this.maxVel = 8;
    this.friction = 0.86;
    this.gravity = 0.56;
    this.jumpForce = -13.2;

    this.facing = 1;
    this.grounded = false;
    this.wallSliding = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.maxJumps = 2;
    this.jumpsUsed = 0;

    this.healthMax = 5;
    this.health = this.healthMax;
    this.iFrames = 0;

    this.dashMax = 100;
    this.dashEnergy = this.dashMax;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCost = 35;

    this.lastSafeCheckpoint = { ...spawn };
  }

  rect() {
    return { x: this.pos.x, y: this.pos.y, w: this.w, h: this.h };
  }

  respawnAtCheckpoint() {
    this.pos.x = this.lastSafeCheckpoint.x;
    this.pos.y = this.lastSafeCheckpoint.y;
    this.vel.x = 0;
    this.vel.y = 0;
    this.isDashing = false;
    this.jumpsUsed = 0;
    this.health = this.healthMax;
    this.iFrames = 40;
  }

  damage(sourceX = this.pos.x) {
    if (this.iFrames > 0) return false;
    this.health -= 1;
    this.iFrames = 55;
    this.vel.x = sourceX > this.pos.x ? -7 : 7;
    this.vel.y = -6;
    return true;
  }

  update(input, level, dt) {
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.dashEnergy = clamp(this.dashEnergy + 0.35 * dt, 0, this.dashMax);

    if (this.grounded) {
      this.coyote = 10;
      this.jumpsUsed = 0;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
      if (this.coyote <= 0 && this.jumpsUsed === 0) this.jumpsUsed = 1;
    }

    if (input.tap('Space')) this.jumpBuffer = 9;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    const dashTap = input.tap('ShiftLeft') || input.tap('ShiftRight') || input.tap('KeyK');
    if (dashTap && this.dashEnergy >= this.dashCost && !this.isDashing) {
      this.isDashing = true;
      this.dashTimer = 10;
      this.dashEnergy -= this.dashCost;
      this.vel.y = 0;
    }

    if (this.isDashing) {
      this.vel.x = this.facing * 15;
      this.vel.y = 0;
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.vel.x *= 0.5;
      }
    } else {
      const axisX = input.axisX();
      if (axisX !== 0) {
        this.vel.x = clamp(this.vel.x + axisX * this.accel * dt, -this.maxVel, this.maxVel);
        this.facing = axisX > 0 ? 1 : -1;
      } else {
        this.vel.x *= Math.pow(this.friction, dt);
      }

      this.wallSliding = false;
      if (!this.grounded && this.touchingWall(level.platforms) && this.vel.y > 0) this.wallSliding = true;
      this.vel.y += (this.wallSliding ? this.gravity * 0.4 : this.gravity) * dt;
    }

    this.pos.x += this.vel.x * dt;
    this.solve(level.platforms, 'x');
    this.pos.y += this.vel.y * dt;
    this.solve(level.platforms, 'y');

    if (this.jumpBuffer > 0) {
      if (this.coyote > 0) {
        this.vel.y = this.jumpForce;
        this.jumpBuffer = 0;
        this.coyote = 0;
        this.jumpsUsed = 1;
      } else if (this.wallSliding) {
        this.vel.y = this.jumpForce;
        this.vel.x = -this.facing * 10;
        this.facing *= -1;
        this.wallSliding = false;
        this.jumpBuffer = 0;
        this.jumpsUsed = 1;
      } else if (this.jumpsUsed < this.maxJumps) {
        this.vel.y = this.jumpForce * 0.85;
        this.jumpsUsed += 1;
        this.jumpBuffer = 0;
      }
    }

    if (!input.down('Space') && this.vel.y < -3) this.vel.y *= Math.pow(0.52, dt);
  }

  touchingWall(platforms) {
    const probe = {
      x: this.facing > 0 ? this.pos.x + this.w : this.pos.x - 2,
      y: this.pos.y + 4,
      w: 2,
      h: this.h - 8
    };
    return platforms.some((p) => overlaps(probe, p));
  }

  solve(platforms, axis) {
    if (axis === 'y') this.grounded = false;
    const self = this.rect();
    for (const p of platforms) {
      if (!overlaps(self, p)) continue;
      if (axis === 'x') {
        const overlapX = (self.x + self.w * 0.5 < p.x + p.w * 0.5)
          ? p.x - (self.x + self.w)
          : p.x + p.w - self.x;
        this.pos.x += overlapX;
        this.vel.x = 0;
        self.x = this.pos.x;
      } else {
        const overlapY = (self.y + self.h * 0.5 < p.y + p.h * 0.5)
          ? p.y - (self.y + self.h)
          : p.y + p.h - self.y;
        if (this.vel.y > 0) this.grounded = true;
        this.pos.y += overlapY;
        this.vel.y = 0;
        self.y = this.pos.y;
      }
    }
  }
}
