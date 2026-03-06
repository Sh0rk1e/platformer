import { Input } from './input.js';
import { formatTime, gradeRun, overlaps } from './utils.js';
import { Player } from '../entities/player.js';
import { Effects } from '../entities/effects.js';
import { spawnEnemies, updateEnemies, updateProjectiles } from '../entities/enemy.js';
import { normalizeLevel, enemyRect } from '../systems/level.js';
import { SaveStore } from '../systems/storage.js';
import { AudioManager } from '../systems/audio.js';
import { Renderer } from '../render/renderer.js';

const FIXED_STEP = 1000 / 60;

export class Game {
  constructor({ canvas, hud }) {
    this.input = new Input();
    this.save = new SaveStore();
    this.audio = new AudioManager(this.save.data.settings);
    this.renderer = new Renderer(canvas, this.save.data.settings);

    this.hud = hud;
    this.state = 'menu';
    this.manifest = null;
    this.campaign = [];
    this.level = null;
    this.levelIndex = 0;

    this.player = null;
    this.effects = new Effects();
    this.enemies = [];
    this.projectiles = [];

    this.levelStartMs = 0;
    this.deaths = 0;
    this.runCollectibles = 0;
    this.summary = null;

    this.accumulator = 0;
    this.lastTs = performance.now();
  }

  async start() {
    await this.loadManifest();
    this.bootstrapUnlocks();
    this.buildMenu();
    this.bindUI();
    this.audio.startMusic();
    requestAnimationFrame((ts) => this.frame(ts));
  }

  async loadManifest() {
    const res = await fetch('./levels/builtin/manifest.json');
    this.manifest = await res.json();
    this.campaign = [...(this.manifest.builtin || [])];
  }

  bootstrapUnlocks() {
    this.campaign.forEach((id, idx) => this.save.ensureLevel(id, idx === 0));
    if (this.manifest.bonus?.length) this.save.ensureLevel(this.manifest.bonus[0], false);
    this.save.persist();
  }

  bindUI() {
    this.hud.pauseBtn.onclick = () => {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      this.renderOverlay();
    };

    this.hud.resumeBtn.onclick = () => {
      this.state = 'playing';
      this.renderOverlay();
    };

    this.hud.restartBtn.onclick = () => this.resetCurrentLevel();

    this.hud.musicVol.oninput = () => this.updateSettings({ musicVol: Number(this.hud.musicVol.value) });
    this.hud.sfxVol.oninput = () => this.updateSettings({ sfxVol: Number(this.hud.sfxVol.value) });
    this.hud.muteToggle.onchange = () => this.updateSettings({ mute: !!this.hud.muteToggle.checked });
    this.hud.reduceShake.onchange = () => this.updateSettings({ reducedShake: !!this.hud.reduceShake.checked });
    this.hud.highContrast.onchange = () => this.updateSettings({ highContrastHazards: !!this.hud.highContrast.checked });

    this.applySettingsToUI();
  }

  updateSettings(patch) {
    this.save.setSettings(patch);
    this.audio.applySettings(this.save.data.settings);
    this.renderer.applySettings(this.save.data.settings);
    this.applySettingsToUI();
  }

  applySettingsToUI() {
    const s = this.save.data.settings;
    this.hud.musicVol.value = String(s.musicVol);
    this.hud.sfxVol.value = String(s.sfxVol);
    this.hud.muteToggle.checked = s.mute;
    this.hud.reduceShake.checked = s.reducedShake;
    this.hud.highContrast.checked = s.highContrastHazards;
  }

  buildMenu() {
    this.hud.levelList.innerHTML = '';

    const makeBtn = (label, id, isLocked, idx, isBonus = false) => {
      const btn = document.createElement('button');
      btn.className = 'lvl-btn';
      btn.textContent = isLocked ? `${label} (LOCKED)` : label;
      btn.disabled = isLocked;
      btn.onclick = () => {
        this.levelIndex = idx;
        this.loadLevelById(id, { isBonus });
      };
      this.hud.levelList.appendChild(btn);
    };

    this.campaign.forEach((f, i) => {
      const state = this.save.ensureLevel(f, i === 0);
      makeBtn(`LEVEL ${i + 1}: ${f.replace('.json', '')}`, f, !state.unlocked, i, false);
    });

    const bonusId = this.manifest.bonus?.[0];
    if (bonusId) {
      const unlocked = this.isBonusUnlocked();
      makeBtn(`BONUS: ${bonusId.replace('.json', '')}`, bonusId, !unlocked, this.campaign.length, true);
    }
  }

  isBonusUnlocked() {
    const threshold = this.manifest.bonusUnlockCollectibles || 10;
    return this.save.data.totalCollectibles >= threshold;
  }

  async loadLevelById(id, { isBonus = false } = {}) {
    const res = await fetch(`./levels/builtin/${id}`);
    const raw = await res.json();
    this.level = normalizeLevel(raw, id);
    this.level.isBonus = isBonus;

    for (const cp of this.level.checkpoints) cp.active = false;
    for (const c of this.level.collectibles) c.collected = false;

    this.player = new Player(this.level.spawnPoint);
    this.enemies = spawnEnemies(this.level.enemies);
    this.projectiles = [];
    this.effects = new Effects();

    this.levelStartMs = performance.now();
    this.deaths = 0;
    this.runCollectibles = 0;
    this.summary = null;

    this.state = 'playing';
    this.hud.levelName.textContent = this.level.levelName;
    this.hud.menu.classList.add('hidden');
    this.renderOverlay(`ENTERING ${this.level.levelName}`);
  }

  resetCurrentLevel() {
    const id = this.level?.meta?.id;
    if (!id) return;
    this.loadLevelById(id, { isBonus: !!this.level.isBonus });
  }

  goToMenu() {
    this.state = 'menu';
    this.level = null;
    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.hud.menu.classList.remove('hidden');
    this.hud.overlay.classList.add('hidden');
    this.hud.levelName.textContent = 'Menu';
    this.hud.timer.textContent = '00:00';
    this.hud.deaths.textContent = '0';
    this.hud.health.textContent = '5/5';
    this.hud.shards.textContent = '0/0';
    this.hud.dash.textContent = '0/100';
  }

  frame(ts) {
    let delta = ts - this.lastTs;
    this.lastTs = ts;
    delta = Math.min(delta, 50);
    this.accumulator += delta;

    while (this.accumulator >= FIXED_STEP) {
      this.update(FIXED_STEP / (1000 / 60));
      this.accumulator -= FIXED_STEP;
      this.input.clearFrame();
    }

    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    this.controlTransitions();

    if (this.input.tap('Escape')) {
      if (this.state === 'playing') this.state = 'paused';
      else if (this.state === 'paused') this.state = 'playing';
      this.renderOverlay();
    }

    if (this.state !== 'playing' || !this.level || !this.player) return;

    if (this.input.tap('KeyR')) this.resetCurrentLevel();

    this.player.update(this.input, this.level, dt);
    this.handleWorldInteractions();

    updateEnemies(this.enemies, this.level.platforms, this.player, dt, this.projectiles);
    updateProjectiles(this.projectiles, dt);

    this.renderer.updateCamera(this.player, dt, this.save.data.settings.reducedShake);
    this.effects.update(dt);
  }

  handleWorldInteractions() {
    const p = this.player.rect();

    for (const h of this.level.hazards) {
      if (overlaps(p, h)) this.applyDamage(h.x);
    }

    for (const projectile of this.projectiles) {
      if (overlaps(p, projectile)) {
        projectile.alive = false;
        this.applyDamage(projectile.x);
      }
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const er = enemyRect(e);
      if (!overlaps(p, er)) continue;

      const stomped = this.player.vel.y > 2 && p.y + p.h - 8 < e.y + 8;
      const dashKill = this.player.isDashing;

      if (stomped || dashKill) {
        e.alive = false;
        this.player.vel.y = -8;
        this.effects.burst(er, '#ffdd88', 10);
        this.audio.sfx(800, 0.06, 'triangle', 1.1);
        this.renderer.pulseShake(this.save.data.settings.reducedShake ? 2 : 6);
      } else {
        this.applyDamage(e.x);
      }
    }

    for (const cp of this.level.checkpoints) {
      if (overlaps(p, cp)) {
        this.player.lastSafeCheckpoint = { x: cp.x, y: cp.y - this.player.h - 2 };
        if (!cp.active) {
          cp.active = true;
          this.effects.burst(cp, '#00ff88', 8);
          this.audio.sfx(620, 0.1, 'sine', 0.8);
        }
      }
    }

    for (const c of this.level.collectibles) {
      if (c.collected) continue;
      if (overlaps(p, c)) {
        c.collected = true;
        this.runCollectibles += 1;
        this.effects.burst(c, '#00ff88', 7);
        this.audio.sfx(950, 0.05, 'square', 0.9);
      }
    }

    for (const t of this.level.triggers) {
      if (t.used) continue;
      if (overlaps(p, t)) {
        t.used = true;
        if (t.type === 'message') this.renderOverlay(t.text || 'Triggered');
      }
    }

    for (const g of this.level.goals) {
      if (overlaps(p, g)) {
        this.finishLevel();
        return;
      }
    }

    if (this.player.health <= 0) {
      this.deaths += 1;
      this.effects.flash = 0.35;
      this.effects.burst(this.player.rect(), '#ff0077', 16);
      this.player.respawnAtCheckpoint();
      this.audio.sfx(180, 0.16, 'sawtooth', 1.2);
      this.renderer.pulseShake(this.save.data.settings.reducedShake ? 2 : 8);
    }

    // Soft fail-safe if player falls out of level bounds.
    if (this.player.pos.y > 2000) {
      this.player.health = 0;
    }
  }

  applyDamage(sourceX) {
    if (!this.player.damage(sourceX)) return;
    this.effects.flash = 0.3;
    this.audio.sfx(220, 0.06, 'sawtooth', 1);
    this.renderer.pulseShake(this.save.data.settings.reducedShake ? 1.5 : 5);
  }

  finishLevel() {
    if (this.state !== 'playing') return;

    const id = this.level.meta.id;
    const timeSec = (performance.now() - this.levelStartMs) / 1000;
    const totalCollectibles = this.level.collectibles.length;
    const grade = gradeRun({
      timeSec,
      deaths: this.deaths,
      collected: this.runCollectibles,
      totalCollectibles,
      parTime: this.level.meta.parTime
    });

    this.save.updateLevelResult(id, {
      timeSec,
      deaths: this.deaths,
      collected: this.runCollectibles,
      grade
    });

    this.save.addCollectibles(this.runCollectibles);

    const campaignIdx = this.campaign.indexOf(id);
    if (campaignIdx >= 0 && campaignIdx < this.campaign.length - 1) {
      this.save.unlockLevel(this.campaign[campaignIdx + 1]);
    }

    if (this.isBonusUnlocked() && this.manifest.bonus?.length) {
      this.save.unlockLevel(this.manifest.bonus[0]);
    }

    this.summary = { id, timeSec, deaths: this.deaths, collected: this.runCollectibles, totalCollectibles, grade };

    if (!this.level.isBonus && campaignIdx === this.campaign.length - 1) {
      this.state = 'gameOver';
      this.renderCampaignSummary();
    } else {
      this.state = 'levelComplete';
      this.renderOverlay(`${this.level.levelName} COMPLETE | Grade ${grade}`);
    }

    this.audio.sfx(740, 0.2, 'triangle', 1.3);
    this.buildMenu();
  }

  renderCampaignSummary() {
    const completed = this.campaign
      .map((id) => ({ id, state: this.save.ensureLevel(id, false) }))
      .filter((x) => x.state.completed);

    const avgDeaths = completed.length
      ? (completed.reduce((sum, x) => sum + (x.state.minDeaths ?? 0), 0) / completed.length).toFixed(1)
      : '0.0';

    this.hud.overlayText.innerHTML = `
      <h2>Campaign Complete</h2>
      <p>Levels cleared: ${completed.length}/${this.campaign.length}</p>
      <p>Total shards: ${this.save.data.totalCollectibles}</p>
      <p>Average best deaths: ${avgDeaths}</p>
      <p>Press Enter to return to menu</p>
    `;
    this.hud.overlay.classList.remove('hidden');
  }

  renderOverlay(message) {
    if (this.state === 'playing') {
      this.hud.overlay.classList.add('hidden');
      return;
    }

    if (this.state === 'paused') {
      this.hud.overlayText.innerHTML = '<h2>Paused</h2><p>Esc to continue</p>';
    } else if (this.state === 'levelComplete') {
      this.hud.overlayText.innerHTML = `
        <h2>Level Complete</h2>
        <p>${this.summary ? `Grade ${this.summary.grade}` : ''}</p>
        <p>Press Enter for next level or M for menu</p>
      `;
    } else if (this.state === 'gameOver') {
      return;
    } else if (message) {
      this.hud.overlayText.innerHTML = `<h2>${message}</h2>`;
    }

    this.hud.overlay.classList.remove('hidden');
  }

  controlTransitions() {
    if (this.state === 'levelComplete' && this.input.tap('Enter')) {
      const current = this.campaign.indexOf(this.level.meta.id);
      if (current >= 0 && current < this.campaign.length - 1) {
        this.levelIndex = current + 1;
        this.loadLevelById(this.campaign[this.levelIndex]);
      } else {
        this.goToMenu();
      }
    }

    if ((this.state === 'levelComplete' || this.state === 'gameOver') && this.input.tap('KeyM')) {
      this.goToMenu();
    }

    if (this.state === 'gameOver' && this.input.tap('Enter')) {
      this.goToMenu();
    }
  }

  render() {
    if (this.state === 'menu' && !this.level) {
      this.renderer.beginFrame();
      this.renderer.endFrame();
      return;
    }

    if (this.level && this.player) {
      this.renderer.beginFrame();
      this.renderer.drawWorld(this.level, this.player, this.enemies, this.projectiles, this.effects, this.save.data.settings);
      this.renderer.endFrame();

      const elapsedSec = this.levelStartMs ? (performance.now() - this.levelStartMs) / 1000 : 0;
      this.hud.timer.textContent = formatTime(elapsedSec);
      this.hud.deaths.textContent = String(this.deaths);
      this.hud.health.textContent = `${this.player.health}/${this.player.healthMax}`;
      this.hud.shards.textContent = `${this.runCollectibles}/${this.level.collectibles.length}`;
      this.hud.dash.textContent = `${Math.round(this.player.dashEnergy)}/${this.player.dashMax}`;
    }
  }
}
