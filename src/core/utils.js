export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const overlaps = (a, b) => (
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y
);

export const rectCenter = (r) => ({ x: r.x + r.w * 0.5, y: r.y + r.h * 0.5 });

export const lerp = (a, b, t) => a + (b - a) * t;

export const formatTime = (seconds) => {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${mins}:${secs}`;
};

export const gradeRun = ({ timeSec, deaths, collected, totalCollectibles, parTime }) => {
  let score = 0;
  if (parTime > 0 && timeSec <= parTime) score += 2;
  if (deaths <= 2) score += 1;
  if (totalCollectibles === 0 || collected === totalCollectibles) score += 2;
  if (score >= 5) return 'S';
  if (score >= 4) return 'A';
  if (score >= 3) return 'B';
  if (score >= 2) return 'C';
  return 'D';
};
