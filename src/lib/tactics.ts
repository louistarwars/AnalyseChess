import { Chess, type Square } from 'chess.js';
import type { Color, PieceType } from './types';

export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

export const PIECE_NAME_FR: Record<PieceType, string> = {
  p: 'pion',
  n: 'cavalier',
  b: 'fou',
  r: 'tour',
  q: 'dame',
  k: 'roi',
};

export const PIECE_ARTICLE_FR: Record<PieceType, string> = {
  p: 'un pion',
  n: 'un cavalier',
  b: 'un fou',
  r: 'une tour',
  q: 'la dame',
  k: 'le roi',
};

export const PIECE_DEF_FR: Record<PieceType, string> = {
  p: 'le pion',
  n: 'le cavalier',
  b: 'le fou',
  r: 'la tour',
  q: 'la dame',
  k: 'le roi',
};

/**
 * Échange statique (SEE) : gain matériel maximal que le camp au trait peut obtenir
 * en initiant une série de prises sur `square` (toujours ≥ 0, il peut ne pas prendre).
 * On utilise les coups légaux, donc clouages et rayons X sont pris en compte.
 */
export function seeGain(chess: Chess, square: Square, depth = 0): number {
  if (depth > 10) return 0;
  const target = chess.get(square);
  if (!target) return 0;
  const captures = chess
    .moves({ verbose: true })
    .filter((m) => m.to === square && m.captured)
    .sort((a, b) => PIECE_VALUE[a.piece] - PIECE_VALUE[b.piece]);
  if (!captures.length) return 0;
  const m = captures[0];
  const value = PIECE_VALUE[target.type] + (m.promotion ? PIECE_VALUE[m.promotion] - 1 : 0);
  chess.move(m);
  const reply = seeGain(chess, square, depth + 1);
  chess.undo();
  return Math.max(0, value - reply);
}

function withTurn(fen: string, turn: Color): string {
  const parts = fen.split(' ');
  parts[1] = turn;
  parts[3] = '-';
  return parts.join(' ');
}

function safeChess(fen: string): Chess | null {
  try {
    return new Chess(fen, { skipValidation: true });
  } catch {
    return null;
  }
}

/** Pièces de `color` (valeur ≥ minValue) qui peuvent être gagnées par l'adversaire au trait. */
export function hangingPieces(fen: string, color: Color, minValue = 1): { square: Square; piece: PieceType; loss: number }[] {
  const opp: Color = color === 'w' ? 'b' : 'w';
  const turn = fen.split(' ')[1] as Color;
  const chess = safeChess(turn === opp ? fen : withTurn(fen, opp));
  if (!chess) return [];
  // Si le camp au trait (adversaire) est en échec après le changement artificiel de trait, on s'abstient.
  if (turn !== opp && chess.inCheck()) return [];
  const res: { square: Square; piece: PieceType; loss: number }[] = [];
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== color || sq.type === 'k' || PIECE_VALUE[sq.type] < minValue) continue;
      const loss = seeGain(chess, sq.square);
      if (loss > 0) res.push({ square: sq.square, piece: sq.type, loss });
    }
  }
  return res.sort((a, b) => b.loss - a.loss);
}

export interface SacrificeInfo {
  square: Square;
  piece: PieceType;
  loss: number;
}

/**
 * Détecte un sacrifice : après le coup, l'adversaire peut gagner au moins `threshold`
 * points de matériel (bilan de l'échange, en comptant ce que le coup a capturé).
 */
export function detectSacrifice(
  fenBefore: string,
  fenAfter: string,
  move: { to: string; piece: PieceType; captured?: PieceType; promotion?: PieceType },
  threshold = 2,
  /** Premier coup de la meilleure réponse adverse (UCI), pour confirmer un sacrifice « par abandon ». */
  replyUci?: string,
): SacrificeInfo | null {
  const mover = fenBefore.split(' ')[1] as Color;
  const after = safeChess(fenAfter);
  if (!after) return null;
  if (after.isGameOver()) return null;
  const captured = move.captured ? PIECE_VALUE[move.captured] : 0;
  const movedPiece: PieceType = move.promotion ?? move.piece;

  // 1) La pièce jouée elle-même
  if (movedPiece !== 'p' && movedPiece !== 'k') {
    const oppGain = seeGain(after, move.to as Square);
    const net = captured - oppGain;
    if (net <= -threshold) return { square: move.to as Square, piece: movedPiece, loss: -net };
  }

  // 2) Une autre pièce laissée en prise (qui ne l'était pas avant le coup)
  const before = hangingPieces(fenBefore, mover, 3);
  const beforeLoss = new Map(before.map((h) => [h.square, h.loss]));
  for (const h of hangingPieces(fenAfter, mover, 3)) {
    if (h.square === move.to) continue;
    const prev = beforeLoss.get(h.square) ?? 0;
    if (h.loss - captured < threshold) continue;
    if (h.loss > prev) return h;
    // Dame ou tour déjà attaquée et laissée en prise volontairement (ex. 17...Fe6!! de Fischer).
    // Pour une tour, on exige que la meilleure réponse adverse consiste bien à la prendre.
    if (h.piece === 'q' && h.loss - captured >= 4) return h;
    if (h.piece === 'r' && replyUci && replyUci.slice(2, 4) === h.square) return h;
  }
  return null;
}

export function materialBalance(fen: string): number {
  const placement = fen.split(' ')[0];
  let s = 0;
  for (const ch of placement) {
    const lower = ch.toLowerCase() as PieceType;
    if (lower in PIECE_VALUE && lower !== 'k') {
      s += (ch === lower ? -1 : 1) * PIECE_VALUE[lower];
    }
  }
  return s; // positif = avantage matériel blanc
}

export function nonPawnPieceCount(fen: string): number {
  const placement = fen.split(' ')[0];
  let n = 0;
  for (const ch of placement) if ('nbrqNBRQ'.includes(ch)) n++;
  return n;
}

/** Joue une ligne UCI et renvoie les SAN (arrête dès qu'un coup est illégal). */
export function uciLineToSan(fen: string, uci: string[], max = 12): { san: string[]; fens: string[]; captured: { color: Color; piece: PieceType }[] } {
  const chess = safeChess(fen);
  const san: string[] = [];
  const fens: string[] = [];
  const captured: { color: Color; piece: PieceType }[] = [];
  if (!chess) return { san, fens, captured };
  for (const u of uci.slice(0, max)) {
    try {
      const m = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      san.push(m.san);
      fens.push(m.after);
      if (m.captured) captured.push({ color: m.color === 'w' ? 'b' : 'w', piece: m.captured });
    } catch {
      break;
    }
  }
  return { san, fens, captured };
}

export function uciToSan(fen: string, uci: string): string | undefined {
  return uciLineToSan(fen, [uci], 1).san[0];
}

export function legalMoveCount(fen: string): number {
  const c = safeChess(fen);
  return c ? c.moves().length : 0;
}
