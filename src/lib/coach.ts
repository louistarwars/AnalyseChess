import type { ClassificationResult } from './classify';
import { PIECE_ARTICLE_FR, PIECE_DEF_FR } from './tactics';
import type { Classification, Color, MoveAnalysis, PlayerSummary } from './types';
import { toFrenchSan } from './notation';

const pick = <T,>(arr: T[], seed: number): T => arr[Math.abs(seed) % arr.length];

function fmtEval(sc: { cp: number; mate?: number }): string {
  if (sc.mate !== undefined) return sc.mate === 0 ? 'mat' : `mat en ${Math.abs(sc.mate)}`;
  const v = sc.cp / 100;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1).replace('.', ',')}`;
}

export function colorName(c: Color, plural = true): string {
  return c === 'w' ? (plural ? 'les Blancs' : 'Blancs') : plural ? 'les Noirs' : 'Noirs';
}

export function moveLabel(ply: number, san: string): string {
  const n = Math.floor(ply / 2) + 1;
  return ply % 2 === 0 ? `${n}. ${toFrenchSan(san)}` : `${n}... ${toFrenchSan(san)}`;
}

interface CoachInput {
  ply: number;
  san: string;
  bestSan?: string;
  opening?: string;
  res: ClassificationResult;
}

/** Commentaire du coach pour un coup (en français, façon « Bilan de partie »). */
export function coachComment({ ply, san, bestSan, opening, res }: CoachInput): string {
  const s = toFrenchSan(san);
  const best = bestSan ? toFrenchSan(bestSan) : undefined;
  const seed = ply * 7 + san.length;
  const bestTxt = best && bestSan !== san ? ` Le meilleur coup était ${best}.` : '';

  const consequence = (): string => {
    if (res.allowsMate !== undefined) return res.allowsMate <= 1 ? ' Cela permet un mat immédiat.' : ` Cela permet un mat en ${res.allowsMate}.`;
    if (res.replyLoss >= 2 && res.lostPiece) return ` L'adversaire peut gagner ${PIECE_ARTICLE_FR[res.lostPiece]}.`;
    if (res.winAfter < 20 && res.winBefore >= 40) return ' La position devient perdante.';
    if (res.winBefore >= 60 && res.winAfter < 55) return " Vous perdez l'avantage.";
    if (res.winBefore >= 45 && res.winAfter < 45 && res.winAfter >= 20) return " L'adversaire prend l'avantage.";
    return ` L'évaluation passe de ${fmtEval(res.scoreBefore)} à ${fmtEval(res.scoreAfter)}.`;
  };

  switch (res.classification) {
    case 'brilliant': {
      const sac = res.sacrifice;
      const what = sac ? `Sacrifier ${PIECE_DEF_FR[sac.piece]} en ${sac.square}` : `${s}`;
      return pick(
        [`${s} est brillant ! ${what}, c'était le coup le plus fort.`, `Coup brillant ! ${what} : une idée magnifique.`, `${s} !! ${what} était la clé de la position.`],
        seed,
      );
    }
    case 'great': {
      const why =
        res.winAfter >= 70 ? "C'était le seul coup pour garder l'avantage." : res.winAfter >= 40 ? "C'était le seul coup pour tenir l'équilibre." : "C'était le seul coup pour rester dans la partie.";
      return `${s} est un très bon coup ! ${why}`;
    }
    case 'best': {
      if (res.tags.includes('checkmate')) return `${s} : échec et mat !`;
      if (res.bestMate !== undefined && res.bestMate <= 5) return `${s} est le meilleur coup. Mat en ${res.bestMate} en vue !`;
      if (res.bestGain >= 2 && res.gainPiece) return `${s} est le meilleur coup et gagne ${PIECE_ARTICLE_FR[res.gainPiece]}.`;
      return pick([`${s} est le meilleur coup.`, `${s} est le coup du moteur. Parfait.`, `Exactement : ${s} est le meilleur coup.`], seed);
    }
    case 'excellent':
      return pick([`${s} est un excellent coup.`, `Excellent : ${s} est presque aussi fort que le meilleur coup.`], seed) + (best ? ` ${best} était très légèrement meilleur.` : '');
    case 'good':
      return `${s} est un bon coup.${best ? ` ${best} était plus précis.` : ''}`;
    case 'book':
      return opening ? `${s} est un coup théorique (${opening}).` : `${s} est un coup théorique.`;
    case 'forced':
      return `${s} était forcé : c'était le seul coup légal.`;
    case 'inaccuracy':
      return `${s} est une imprécision.${consequence()}${bestTxt}`;
    case 'mistake':
      return `${s} est une erreur.${consequence()}${bestTxt}`;
    case 'miss': {
      if (res.bestMate !== undefined) return `Occasion manquée ! ${best ?? 'Un autre coup'} menait à un mat en ${res.bestMate}.`;
      if (res.bestGain >= 2 && res.gainPiece) return `Occasion manquée ! ${best ?? 'Un autre coup'} permettait de gagner ${PIECE_ARTICLE_FR[res.gainPiece]}.`;
      return `Occasion manquée ! ${best ?? 'Un autre coup'} aurait puni l'erreur de l'adversaire.`;
    }
    case 'blunder':
      return `${s} est une gaffe !${consequence()}${bestTxt}`;
  }
}

const CLS_ORDER: Classification[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder', 'forced'];
export { CLS_ORDER };

/** Message d'introduction du « coach » pour le bilan de partie. */
export function coachIntro(moves: MoveAnalysis[], white: PlayerSummary, black: PlayerSummary, result: string, names: { w: string; b: string }): string {
  const parts: string[] = [];
  const brilliant = moves.filter((m) => m.classification === 'brilliant');
  const winner: Color | null = result === '1-0' ? 'w' : result === '0-1' ? 'b' : null;
  const acc = { w: white.accuracy, b: black.accuracy };

  if (brilliant.length) {
    const value = (x: MoveAnalysis) => ({ q: 9, r: 5, b: 3, n: 3, p: 1, k: 0 })[x.sacrifice?.piece ?? 'p'];
    const m = [...brilliant].sort((a, b) => value(b) - value(a) || a.ply - b.ply)[0];
    parts.push(`Quel coup brillant de ${names[m.color]} : ${moveLabel(m.ply, m.san)} !!`);
  }
  // Tournant : plus grosse chute de chances de gain
  let turning: MoveAnalysis | undefined;
  for (const m of moves) {
    if (!['inaccuracy', 'mistake', 'miss', 'blunder'].includes(m.classification)) continue;
    const drop = m.winBefore - m.winAfter;
    if (drop >= 20 && (!turning || drop > turning.winBefore - turning.winAfter)) turning = m;
  }
  if (turning) {
    const sym = turning.classification === 'blunder' ? '??' : turning.classification === 'mistake' ? '?' : turning.classification === 'inaccuracy' ? '?!' : '';
    parts.push(`Le tournant de la partie : ${moveLabel(turning.ply, turning.san)}${sym}`);
  }
  if (winner) {
    const loser: Color = winner === 'w' ? 'b' : 'w';
    if ((acc[winner] ?? 0) >= 85) parts.push(`${names[winner]} a joué avec une grande précision (${Math.round(acc[winner] ?? 0)} %).`);
    else if ((acc[loser] ?? 0) > (acc[winner] ?? 0)) parts.push(`${names[loser]} a été plus précis mais n'a pas su conclure.`);
    else parts.push(`Victoire de ${names[winner]}.`);
  } else if (result === '1/2-1/2') {
    parts.push(Math.abs((acc.w ?? 0) - (acc.b ?? 0)) < 5 ? 'Une partie équilibrée qui se termine par la nulle.' : 'La partie se termine par la nulle.');
  }
  const totalBlunders = white.counts.blunder + black.counts.blunder;
  if (!turning && totalBlunders === 0) parts.push('Aucune gaffe dans cette partie, bravo !');
  return parts.join(' ');
}
