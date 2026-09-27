import type { Color, Score } from './types';
import { winPercentCapped } from './evaluation';

/** Précision d'un coup à partir des chances de gain avant / après (formule Lichess). */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100;
  const diff = winBefore - winAfter;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * diff) - 3.166924740191411;
  return Math.max(0, Math.min(100, raw + 1));
}

function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
}

/**
 * Précision globale par joueur (moyenne pondérée par la volatilité + moyenne harmonique),
 * reprise de l'algorithme open source de Lichess.
 * `evals[i]` = évaluation (point de vue des Blancs) après le demi-coup i ; evals[0] = position initiale.
 */
export function gameAccuracy(evals: Score[], startColor: Color): Record<Color, number | undefined> & { perMove: number[] } {
  const wins = evals.map((s) => winPercentCapped(s, 'w'));
  const moves = wins.length - 1;
  const perMove: number[] = [];
  if (moves <= 0) return { w: undefined, b: undefined, perMove };
  const windowSize = Math.max(2, Math.min(8, Math.floor(moves / 10)));
  const windows: number[][] = [];
  const pre = Math.min(windowSize, wins.length) - 2;
  for (let i = 0; i < pre; i++) windows.push(wins.slice(0, windowSize));
  for (let i = 0; i + windowSize <= wins.length; i++) windows.push(wins.slice(i, i + windowSize));
  const weights = windows.map((w) => Math.max(0.5, Math.min(12, stdDev(w))));

  const acc: Record<Color, { a: number; w: number }[]> = { w: [], b: [] };
  for (let i = 0; i < moves; i++) {
    const color: Color = (i % 2 === 0) === (startColor === 'w') ? 'w' : 'b';
    const prev = wins[i];
    const next = wins[i + 1];
    const a = color === 'w' ? moveAccuracy(prev, next) : moveAccuracy(100 - prev, 100 - next);
    perMove.push(a);
    acc[color].push({ a, w: weights[i] ?? 1 });
  }
  const combine = (xs: { a: number; w: number }[]) => {
    if (!xs.length) return undefined;
    const sw = xs.reduce((s, x) => s + x.w, 0);
    const weighted = xs.reduce((s, x) => s + x.a * x.w, 0) / sw;
    const harmonic = xs.length / xs.reduce((s, x) => s + 1 / Math.max(1, x.a), 0);
    return (weighted + harmonic) / 2;
  };
  return { w: combine(acc.w), b: combine(acc.b), perMove };
}

export function harmonicMean(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  return xs.length / xs.reduce((s, x) => s + 1 / Math.max(1, x), 0);
}

export function mean(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Moyenne « précision de phase » : mélange moyenne arithmétique / harmonique. */
export function phaseAccuracy(xs: number[]): number | undefined {
  if (xs.length < 2) return undefined;
  return ((mean(xs) ?? 0) + (harmonicMean(xs) ?? 0)) / 2;
}
