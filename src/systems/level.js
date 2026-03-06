const DEFAULT_META = {
  id: 'unknown',
  title: 'Untitled',
  parTime: 60,
  collectibleTarget: 0
};

export const normalizeLevel = (raw, id) => {
  const meta = {
    ...DEFAULT_META,
    id,
    title: raw.levelName || raw.meta?.title || id,
    parTime: raw.parTime || raw.meta?.parTime || DEFAULT_META.parTime,
    collectibleTarget: raw.meta?.collectibleTarget || (raw.collectibles ? raw.collectibles.length : 0)
  };

  return {
    levelName: raw.levelName || meta.title,
    meta,
    spawnPoint: raw.spawnPoint || { x: 64, y: 64 },
    platforms: raw.platforms || [],
    hazards: raw.hazards || [],
    goals: raw.goals || [],
    checkpoints: raw.checkpoints || [],
    collectibles: raw.collectibles || [],
    enemies: raw.enemies || [],
    triggers: raw.triggers || []
  };
};

export const enemyRect = (enemy) => ({ x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h });
