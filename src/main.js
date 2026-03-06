import { Game } from './core/game.js';

const hud = {
  levelName: document.getElementById('current-lvl-name'),
  timer: document.getElementById('timer'),
  deaths: document.getElementById('death-count'),
  health: document.getElementById('health-count'),
  shards: document.getElementById('shard-count'),
  dash: document.getElementById('dash-count'),
  menu: document.getElementById('menu'),
  levelList: document.getElementById('lvl-list'),
  pauseBtn: document.getElementById('pause-btn'),
  resumeBtn: document.getElementById('resume-btn'),
  restartBtn: document.getElementById('restart-btn'),
  musicVol: document.getElementById('music-vol'),
  sfxVol: document.getElementById('sfx-vol'),
  muteToggle: document.getElementById('mute-toggle'),
  reduceShake: document.getElementById('reduce-shake'),
  highContrast: document.getElementById('high-contrast'),
  overlay: document.getElementById('overlay'),
  overlayText: document.getElementById('overlay-text')
};

const game = new Game({
  canvas: document.getElementById('gameCanvas'),
  hud
});

game.start();

document.addEventListener('click', () => {
  game.audio.startMusic();
}, { once: true });
