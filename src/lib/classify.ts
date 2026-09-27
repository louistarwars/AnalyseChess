import type { Square } from 'chess.js';
import { Chess } from 'chess.js';
import { winPercent } from './evaluation';
import { detectSacrifice, materialBalance, seeGain, uciLineToSan, type SacrificeInfo } from './tactics';
import type { Classification, Color, PieceType, PositionEval, Score } from './types';

export interface MoveContext {
  uci: string;
  san: string;
  from: string;
  to: string;
  color: Color;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  fenBefore: string;
  fenAfter: string;
  before: PositionEval;
  after: PositionEval;
  inBook: boolean;
  legalMoves: number;
  /** Coup précédent (adversaire) : case d'arrivée, prise éventuelle et perte de chances de gain. */
  prev?: { to: string; captured?: PieceType; loss: number; winBeforeOpp: number };
  /** Évaluations réconciliées (voir buildAnalysis) ; par défaut celles du moteur. */
  scoreBefore?: Score;
  scoreAfter?: Score;
}

export interface ClassificationResult {
  classification: Classification;
  tags: string[];
  winBefore: number;
  winAfter: number;
  loss: number;
  scoreBefore: Score;
  scoreAfter: Score;
  sacrifice?: SacrificeInfo;
  /** Gain matériel de la meilleure suite (pour le joueur), en points. */
  bestGain: number;
  /** Perte matérielle dans la meilleure réponse adverse après le coup joué. */
  replyLoss: number;
  lostPiece?: PieceType;
  gainPiece?: PieceType;
  bestMate?: number; // mat disponible pour le joueur (en coups)
  allowsMate?: number; // mat concédé à l'adversaire
}

export function bestScore(ev: PositionEval): Score {
  if (ev.terminal === 'checkmate') {
    const turn = ev.fen.split(' ')[1];
    return { cp: turn === 'w' ? -10000 : 10000, mate: 0 };
  }
  if (ev.terminal) return { cp: 0 };
  return ev.lines[0]?.score ?? { cp: 0 };
}

/** Bilan matériel (pour `color`) au bout d'une ligne UCI, relatif à la position de départ. */
function lineMaterial(fen: string, pv: string[], color: Color, plies: number): { gain: number; biggestGain?: PieceType; biggestLoss?: PieceType } {
  const { fens, captured } = uciLineToSan(fen, pv, plies);
  if (!fens.length) return { gain: 0 };
  const sign = color === 'w' ? 1 : -1;
  // On évalue le matériel à un point « calme » : fin de ligne sur un nombre pair de demi-coups si possible.
  const endIdx = fens.length % 2 === 0 || fens.length === 1 ? fens.length - 1 : fens.length - 2;
  const gain = sign * (materialBalance(fens[Math.max(0, endIdx)]) - materialBalance(fen));
  const order: PieceType[] = ['q', 'r', 'b', 'n', 'p'];
  const lost = captured.filter((c) => c.color === color).map((c) => c.piece);
  const won = captured.filter((c) => c.color !== color).map((c) => c.piece);
  return {
    gain,
    biggestGain: order.find((p) => won.includes(p)),
    biggestLoss: order.find((p) => lost.includes(p)),
  };
}

export function classifyMove(ctx: MoveContext): ClassificationResult {
  const mover = ctx.color;
  const scoreBefore = ctx.scoreBefore ?? bestScore(ctx.before);
  const scoreAfter = ctx.scoreAfter ?? bestScore(ctx.after);
  const w0 = winPercent(scoreBefore, mover);
  const w1 = winPercent(scoreAfter, mover);
  const loss = Math.max(0, w0 - w1);
  const top = ctx.before.lines[0];
  const second = ctx.before.lines[1];
  const isTop = !!top && top.move === ctx.uci;
  const w2 = second ? winPercent(second.score, mover) : undefined;
  const tags: string[] = [];

  if (ctx.captured) tags.push('capture');
  if (ctx.san.includes('+')) tags.push('check');
  if (ctx.san.includes('#')) tags.push('checkmate');
  if (ctx.san.startsWith('O-O')) tags.push('castle');
  if (ctx.promotion) tags.push('promotion');
  const isRecapture = !!ctx.captured && !!ctx.prev?.captured && ctx.prev.to === ctx.to;
  if (isRecapture) tags.push('recapture');

  // Mat disponible / concédé
  const moverSign = mover === 'w' ? 1 : -1;
  const bestMate = scoreBefore.mate !== undefined && scoreBefore.mate * moverSign > 0 ? Math.abs(scoreBefore.mate) : undefined;
  const allowsMate = scoreAfter.mate !== undefined && scoreAfter.mate * moverSign < 0 ? Math.abs(scoreAfter.mate) : undefined;
  const keepsMate = scoreAfter.mate !== undefined && scoreAfter.mate * moverSign >= 0;

  // Matériel : ce que la meilleure suite aurait gagné, ce que la réponse adverse gagne.
  const bestLine = top ? lineMaterial(ctx.fenBefore, top.pv, mover, 6) : { gain: 0 };
  const replyPv = ctx.after.lines[0]?.pv ?? [];
  const playedLine = lineMaterial(ctx.fenBefore, [ctx.uci, ...replyPv], mover, 7);
  const bestGain = bestLine.gain;
  const replyLoss = Math.max(0, -playedLine.gain);

  const result = (classification: Classification, extra: Partial<ClassificationResult> = {}): ClassificationResult => ({
    classification,
    tags,
    winBefore: w0,
    winAfter: w1,
    loss,
    scoreBefore,
    scoreAfter,
    bestGain,
    replyLoss,
    lostPiece: playedLine.biggestLoss,
    gainPiece: bestLine.biggestGain,
    bestMate,
    allowsMate,
    ...extra,
  });

  if (bestMate !== undefined || bestGain >= 2) tags.push('opportunity');
  if (allowsMate !== undefined) tags.push('allowsMate');

  if (ctx.legalMoves === 1) return result('forced');
  if (ctx.inBook) return result('book');

  let cls: Classification;
  if (isTop) cls = 'best';
  else if (loss <= 2) cls = 'excellent';
  else if (loss <= 5) cls = 'good';
  else if (loss <= 10) cls = 'inaccuracy';
  else if (loss <= 20) cls = 'mistake';
  else cls = 'blunder';

  // Mat sur l'échiquier = toujours le meilleur coup
  if (ctx.after.terminal === 'checkmate') return result('best');

  // --- Brillant : sacrifice correct, sans être déjà totalement gagnant ---
  if (cls === 'best' || cls === 'excellent') {
    const sac = detectSacrifice(
      ctx.fenBefore,
      ctx.fenAfter,
      { to: ctx.to, piece: ctx.piece, captured: ctx.captured, promotion: ctx.promotion },
      2,
      ctx.after.lines[0]?.move,
    );
    if (sac && !isRecapture) {
      tags.push('sacrifice');
      const notAlreadyWinning = w0 < 95 || (w2 !== undefined && w2 < 80);
      if (w1 >= 45 && notAlreadyWinning && loss <= 2.5) return result('brilliant', { sacrifice: sac });
      // Sacrifice de dame/tour qui force le mat alors que les autres coups ne matent pas.
      const secondMates = second?.score.mate !== undefined && second.score.mate * moverSign > 0 && Math.abs(second.score.mate) <= (bestMate ?? 0) + 1;
      if (bestMate !== undefined && isTop && PIECE_VALUE_CLS[sac.piece] >= 5 && !secondMates) return result('brilliant', { sacrifice: sac });
    }
  }

  // --- Très bon coup : seul coup qui tient (gros écart avec la 2e meilleure option) ---
  if ((cls === 'best' || (cls === 'excellent' && loss <= 1)) && w2 !== undefined && top) {
    const margin = w0 - w2;
    let simpleWin = false;
    if (ctx.captured) {
      try {
        const after = new Chess(ctx.fenAfter);
        const net = ctxValue(ctx.captured) - seeGain(after, ctx.to as Square);
        simpleWin = net > 0;
      } catch {
        simpleWin = false;
      }
    }
    const alreadyCrushing = w2 >= 90;
    const inCheck = isInCheck(ctx.fenBefore);
    if (margin >= 20 && !isRecapture && !simpleWin && !alreadyCrushing && !inCheck && w1 >= 25) {
      tags.push('onlyMove');
      return result('great');
    }
  }

  // --- Occasion manquée ---
  if (cls === 'inaccuracy' || cls === 'mistake' || cls === 'blunder' || (cls === 'good' && bestMate !== undefined)) {
    const opponentErred = ctx.prev && ctx.prev.loss >= 10;
    const baseline = ctx.prev ? 100 - ctx.prev.winBeforeOpp : 50; // nos chances avant l'erreur adverse
    if (opponentErred && loss >= 8 && w1 >= baseline - 6 && w0 - baseline >= 10) return result('miss');
    if (bestMate !== undefined && bestMate <= 4 && !keepsMate && w1 >= 50) return result('miss');
    if (bestGain >= 3 && loss >= 8 && w1 >= 40 && playedLine.gain < bestGain - 2) return result('miss');
  }

  return result(cls);
}

const PIECE_VALUE_CLS: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function ctxValue(p: PieceType): number {
  return PIECE_VALUE_CLS[p];
}

function isInCheck(fen: string): boolean {
  try {
    return new Chess(fen).inCheck();
  } catch {
    return false;
  }
}
