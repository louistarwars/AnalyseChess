/** Estimation de la performance Elo à partir de la précision et de la perte moyenne (ACPL). */

const ACC_POINTS: [number, number][] = [
  [0, 100],
  [40, 250],
  [50, 450],
  [58, 700],
  [64, 950],
  [69, 1200],
  [73.5, 1450],
  [77.5, 1700],
  [81, 1950],
  [84.5, 2200],
  [88, 2450],
  [91, 2700],
  [94, 2900],
  [97, 3100],
  [100, 3300],
];

function interp(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x0, y0] = points[i - 1];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}

export interface EloInput {
  accuracy: number;
  acpl: number;
  moves: number;
  blunders: number;
  mistakes: number;
}

export function estimateElo({ accuracy, acpl, moves, blunders, mistakes }: EloInput): number {
  const fromAcc = interp(ACC_POINTS, accuracy);
  const fromAcpl = Math.max(100, Math.min(3300, 3200 * Math.exp(-0.0105 * acpl)));
  let est = 0.62 * fromAcc + 0.38 * fromAcpl;
  const n = Math.max(1, moves);
  est -= 350 * (blunders / n) + 120 * (mistakes / n);
  // Peu de coups = estimation peu fiable : on la ramène vers la moyenne.
  const k = n / (n + 4);
  est = 1500 + (est - 1500) * k;
  return Math.round(Math.max(100, Math.min(3300, est)) / 10) * 10;
}

export interface EloSample {
  elo: number;
  moves: number;
  timestamp: number;
}

/** Combine les performances de plusieurs parties (pondérées par la longueur et la récence). */
export function aggregateElo(samples: EloSample[]): { elo: number; margin: number; n: number } | undefined {
  if (!samples.length) return undefined;
  const sorted = [...samples].sort((a, b) => b.timestamp - a.timestamp).slice(0, 40);
  let sw = 0;
  let s = 0;
  sorted.forEach((x, i) => {
    const w = Math.min(40, x.moves) * Math.pow(0.96, i);
    sw += w;
    s += w * x.elo;
  });
  const elo = s / sw;
  const variance = sorted.reduce((a, x) => a + (x.elo - elo) ** 2, 0) / sorted.length;
  const margin = Math.sqrt(variance) / Math.sqrt(sorted.length) * 1.96;
  return { elo: Math.round(elo / 10) * 10, margin: Math.round(Math.max(25, margin) / 5) * 5, n: sorted.length };
}

/** Régression linéaire simple sur l'historique Elo pour projeter la tendance. */
export function projectRating(points: { t: number; r: number }[], daysAhead = 30): { slopePerMonth: number; projected: number } | undefined {
  const pts = points.filter((p) => Number.isFinite(p.r) && p.r > 0);
  if (pts.length < 5) return undefined;
  const t0 = pts[0].t;
  const xs = pts.map((p) => (p.t - t0) / 86400000);
  const ys = pts.map((p) => p.r);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den > 0 ? num / den : 0; // Elo par jour
  const clamped = Math.max(-8, Math.min(8, slope));
  const last = ys.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, ys.length);
  return { slopePerMonth: Math.round(clamped * 30), projected: Math.round(last + clamped * daysAhead) };
}
