const SAVE_KEY = 'neon-pulse-save-v2';

const defaultData = () => ({
  levels: {},
  settings: {
    musicVol: 0.35,
    sfxVol: 0.55,
    mute: false,
    reducedShake: false,
    highContrastHazards: false
  },
  totalCollectibles: 0
});

export class SaveStore {
  constructor() {
    this.data = defaultData();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.data = {
        ...defaultData(),
        ...parsed,
        settings: { ...defaultData().settings, ...(parsed.settings || {}) },
        levels: parsed.levels || {}
      };
    } catch {
      this.data = defaultData();
    }
  }

  persist() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
  }

  ensureLevel(id, unlocked = false) {
    if (!this.data.levels[id]) {
      this.data.levels[id] = {
        unlocked,
        completed: false,
        bestTime: null,
        minDeaths: null,
        maxCollectibles: 0,
        bestGrade: null
      };
    }
    return this.data.levels[id];
  }

  updateLevelResult(id, result) {
    const level = this.ensureLevel(id, false);
    level.completed = true;
    level.bestTime = level.bestTime == null ? result.timeSec : Math.min(level.bestTime, result.timeSec);
    level.minDeaths = level.minDeaths == null ? result.deaths : Math.min(level.minDeaths, result.deaths);
    level.maxCollectibles = Math.max(level.maxCollectibles, result.collected);
    const rank = ['D', 'C', 'B', 'A', 'S'];
    if (!level.bestGrade || rank.indexOf(result.grade) > rank.indexOf(level.bestGrade)) level.bestGrade = result.grade;
    this.persist();
  }

  unlockLevel(id) {
    this.ensureLevel(id, true).unlocked = true;
    this.persist();
  }

  setSettings(next) {
    this.data.settings = { ...this.data.settings, ...next };
    this.persist();
  }

  addCollectibles(count) {
    this.data.totalCollectibles += count;
    this.persist();
  }
}
