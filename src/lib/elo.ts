/**
 * Estimation de la performance Elo d'une partie (modèle v2).
 *
 * Calibré par simulation (joueurs « humains » simulés avec Stockfish à des taux d'erreurs
 * typiques de chaque niveau, puis analysés par l'application). Trois signaux sont combinés :
 *  - le taux d'erreurs pondéré (gaffe > occasion manquée > erreur > imprécision), le plus discriminant ;
 *  - la précision (échelle volontairement sévère : l'algorithme Lichess est indulgent) ;
 *  - la perte moyenne en centipions (ACPL).
 * Tous les coups joués comptent (hors théorie et coups forcés) : une partie décidée tôt par une gaffe
 * n'est plus jugée sur ses seuls bons coups d'ouverture. L'Elo réel du joueur, quand il est connu,
 * sert d'a priori (moyenne bayésienne) pour éviter les valeurs aberrantes sur une seule partie.
 */

export const ELO_MODEL_VERSION = 2;

const ACC_POINTS: [number, number][] = [
  [0, 100],
  [45, 250],
  [60, 500],
  [70, 850],
  [76, 1100],
  [82, 1450],
  [87, 1800],
  [90, 2100],
  [93, 2450],
  [95.5, 2750],
  [98, 3050],
  [100, 3250],
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
  /** Coups comptés (hors théorie et coups forcés). */
  moves: number;
  blunders: number;
  mistakes: number;
  misses?: number;
  inaccuracies?: number;
  /** Elo réel du joueur dans cette partie, s'il est connu. */
  rating?: number;
}

export function estimateElo({ accuracy, acpl, moves, blunders, mistakes, misses = 0, inaccuracies = 0, rating }: EloInput): number {
  const n = Math.max(1, moves);
  const errorRate = (blunders + 0.8 * misses + 0.5 * mistakes + 0.15 * inaccuracies) / n;
  const fromErrors = 1000 - 700 * Math.log(Math.max(0.005, errorRate) / 0.1);
  const fromAcc = interp(ACC_POINTS, accuracy);
  const fromAcpl = 3000 * Math.exp(-0.016 * acpl);
  let est = 0.45 * fromErrors + 0.3 * fromAcc + 0.25 * fromAcpl;
  est = Math.max(100, Math.min(3200, est));
  // Moyenne bayésienne : une partie courte renseigne peu, on la ramène vers l'a priori.
  const prior = rating && rating > 0 ? rating : 1500;
  const weight = n / (n + (rating ? 10 : 8));
  est = prior + (est - prior) * weight;
  return Math.round(Math.max(100, Math.min(3200, est)) / 10) * 10;
}

/** Recalcule l'Elo estimé à partir d'un résumé de joueur déjà stocké (migration des anciennes analyses). */
export function eloFromSummary(
  s: { accuracy: number; acpl: number; moves: number; counts: Record<string, number> },
  rating?: number,
): number {
  const counted = Math.max(1, s.moves - (s.counts.book ?? 0) - (s.counts.forced ?? 0));
  return estimateElo({
    accuracy: s.accuracy,
    acpl: s.acpl,
    moves: counted,
    blunders: s.counts.blunder ?? 0,
    mistakes: s.counts.mistake ?? 0,
    misses: s.counts.miss ?? 0,
    inaccuracies: s.counts.inaccuracy ?? 0,
    rating,
  });
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
