import type { Color, Score } from './types';

export const MATE_CP = 10000;

export function mateScore(mateWhitePov: number): Score {
  const sign = mateWhitePov > 0 || Object.is(mateWhitePov, 0) ? 1 : -1;
  return { cp: sign * (MATE_CP - Math.abs(mateWhitePov)), mate: mateWhitePov };
}

/** Score depuis le point de vue du trait (UCI) → point de vue des Blancs. */
export function fromUci(kind: 'cp' | 'mate', value: number, turn: Color): Score {
  const sign = turn === 'w' ? 1 : -1;
  if (kind === 'mate') {
    const m = value * sign;
    return { cp: (m > 0 ? 1 : -1) * (MATE_CP - Math.abs(m)), mate: m };
  }
  return { cp: value * sign };
}

export function povCp(score: Score, color: Color): number {
  return color === 'w' ? score.cp : -score.cp;
}

/** Probabilité de gain (0-100) selon la formule publique de Lichess. */
export function winPercentFromCp(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/** Chances de gain (0-100) pour `color`. Un mat forcé vaut 100 / 0. */
export function winPercent(score: Score, color: Color): number {
  if (score.mate !== undefined) {
    const whiteWins = score.cp > 0;
    return (whiteWins ? 1 : 0) === (color === 'w' ? 1 : 0) ? 100 : 0;
  }
  return winPercentFromCp(povCp(score, color));
}

/** Variante « Lichess » : les mats sont plafonnés à ±1000 cp (utilisé pour la précision). */
export function winPercentCapped(score: Score, color: Color): number {
  return winPercentFromCp(povCp(score, color));
}

export function formatScore(score: Score, short = false): string {
  if (score.mate !== undefined) {
    if (score.mate === 0) return '#';
    return `${score.mate > 0 ? '' : '-'}M${Math.abs(score.mate)}`;
  }
  const v = score.cp / 100;
  const abs = Math.abs(v);
  const txt = short && abs >= 10 ? abs.toFixed(0) : abs.toFixed(abs >= 10 ? 1 : short ? 1 : 2);
  if (Math.abs(score.cp) < 5) return short ? '0.0' : '0.00';
  return `${v > 0 ? '+' : '-'}${txt}`;
}

/** Hauteur de la barre d'évaluation (part des Blancs, 0-100). */
export function evalBarPercent(score: Score): number {
  if (score.mate !== undefined) return score.cp > 0 ? 100 : 0;
  const w = winPercentFromCp(score.cp);
  return Math.max(4, Math.min(96, w));
}
