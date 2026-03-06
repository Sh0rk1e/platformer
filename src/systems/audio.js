export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.musicOsc = null;
    this.musicGain = null;
    this.masterGain = null;
  }

  ensureContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.settings.mute ? 0 : 1;
    this.masterGain.connect(this.ctx.destination);
  }

  applySettings(settings) {
    this.settings = settings;
    if (!this.ctx) return;
    this.masterGain.gain.value = settings.mute ? 0 : 1;
    if (this.musicGain) this.musicGain.gain.value = settings.musicVol * 0.07;
  }

  startMusic() {
    this.ensureContext();
    if (!this.ctx || this.musicOsc) return;
    this.musicOsc = this.ctx.createOscillator();
    this.musicGain = this.ctx.createGain();
    this.musicOsc.type = 'triangle';
    this.musicOsc.frequency.value = 110;
    this.musicGain.gain.value = this.settings.musicVol * 0.07;
    this.musicOsc.connect(this.musicGain);
    this.musicGain.connect(this.masterGain);
    this.musicOsc.start();
  }

  stopMusic() {
    if (!this.musicOsc) return;
    this.musicOsc.stop();
    this.musicOsc.disconnect();
    this.musicGain.disconnect();
    this.musicOsc = null;
    this.musicGain = null;
  }

  sfx(freq = 440, duration = 0.08, type = 'square', gainScale = 1) {
    this.ensureContext();
    if (!this.ctx || this.settings.mute) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = Math.max(0.01, this.settings.sfxVol * 0.08 * gainScale);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
