import { Chess } from 'chess.js';
import { gameAccuracy, phaseAccuracy } from './accuracy';
import { bestScore, classifyMove, type ClassificationResult } from './classify';
import { coachComment, coachIntro } from './coach';
import { ELO_MODEL_VERSION, eloFromSummary } from './elo';
import { CancelledError, type Engine } from './engine';
import { povCp } from './evaluation';
import { identifyOpening, loadOpenings, lookupSync } from './openings';
import { initialClock, parseGame, type ParsedGame } from './pgn';
import { legalMoveCount, nonPawnPieceCount, uciLineToSan, uciToSan } from './tactics';
import type { Classification, Color, GameAnalysis, MoveAnalysis, PlayerSummary, PositionEval, Score } from './types';

export interface AnalysisProgress {
  done: number;
  total: number;
  fen: string;
  ply: number;
  score?: Score;
}

export interface AnalyzeGameOptions {
  depth: number;
  engine: Engine;
  onProgress?: (p: AnalysisProgress) => void;
  signal?: AbortSignal;
}

export const EMPTY_COUNTS = (): Record<Classification, number> => ({
  brilliant: 0,
  great: 0,
  best: 0,
  excellent: 0,
  good: 0,
  book: 0,
  inaccuracy: 0,
  mistake: 0,
  miss: 0,
  blunder: 0,
  forced: 0,
});

function terminalEval(fen: string): PositionEval | null {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { fen, depth: 0, lines: [], terminal: 'checkmate' };
  if (c.isStalemate() || c.isInsufficientMaterial()) return { fen, depth: 0, lines: [], terminal: c.isStalemate() ? 'stalemate' : 'draw' };
  return null;
}

/** Évalue chaque position de la partie avec Stockfish. */
async function evaluatePositions(parsed: ParsedGame, bookPlies: number, opts: AnalyzeGameOptions): Promise<PositionEval[]> {
  const { engine, depth, signal } = opts;
  const evals: PositionEval[] = [];
  const total = parsed.fens.length;
  engine.newGame();
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new CancelledError();
    const fen = parsed.fens[i];
    let ev = terminalEval(fen);
    if (!ev) {
      const d = i < bookPlies ? Math.min(depth, 10) : depth;
      const job = engine.analyze(fen, { depth: d, multiPv: 2, movetime: depth >= 16 ? 8000 : 4000 });
      const onAbort = () => job.cancel();
      signal?.addEventListener('abort', onAbort);
      try {
        ev = await job.promise;
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }
    }
    evals.push(ev);
    opts.onProgress?.({ done: i + 1, total, fen, ply: i, score: bestScore(ev) });
  }
  return evals;
}

function computePhases(fens: string[], bookPlies: number): { middlegame: number; endgame: number } {
  let endgame = fens.length;
  let lowMaterial = fens.length;
  for (let i = 0; i < fens.length; i++) {
    const n = nonPawnPieceCount(fens[i]);
    if (lowMaterial === fens.length && n <= 10) lowMaterial = i;
    if (n <= 6) {
      endgame = i;
      break;
    }
  }
  let middlegame = Math.max(Math.min(lowMaterial, 20), bookPlies + 1);
  if (middlegame > endgame) middlegame = endgame;
  return { middlegame, endgame };
}

/**
 * Réconcilie les évaluations successives : si le coup joué figurait parmi les lignes du moteur
 * dans la position précédente, on garde l'évaluation la plus favorable au joueur entre
 * celle de cette ligne et celle de la position suivante. Cela évite de pénaliser un coup
 * « meilleur » à cause de l'horizon limité de la recherche suivante.
 */
function reconcileScores(parsed: ParsedGame, evals: PositionEval[]): Score[] {
  const scores = evals.map(bestScore);
  parsed.moves.forEach((m, i) => {
    const next = evals[i + 1];
    if (!next || next.terminal) return;
    const line = evals[i].lines.find((l) => l.move === m.uci);
    if (!line) return;
    // Un mat trouvé par la recherche suivante est prouvé : on ne l'écrase pas par une ligne sans mat.
    if (scores[i + 1].mate !== undefined && line.score.mate === undefined) return;
    if (povCp(line.score, m.color) > povCp(scores[i + 1], m.color)) scores[i + 1] = line.score;
  });
  return scores;
}

export function buildAnalysis(gameId: string, parsed: ParsedGame, evals: PositionEval[], depth: number): GameAnalysis {
  const { opening, bookPlies } = identifyOpening(parsed.fens);
  const phases = computePhases(parsed.fens, bookPlies);
  const scores = reconcileScores(parsed, evals);
  const startColor = parsed.fens[0].split(' ')[1] as Color;
  const acc = gameAccuracy(scores, startColor);
  const tc = initialClock(parsed.headers.TimeControl);

  const moves: MoveAnalysis[] = [];
  const results: ClassificationResult[] = [];
  let stillBook = true;
  let currentOpening: string | undefined;

  parsed.moves.forEach((m, i) => {
    const book = stillBook ? lookupSync(m.fenAfter) : { inBook: false };
    if (!book.inBook) stillBook = false;
    if (book.opening) currentOpening = book.opening.name;
    const prevMove = moves[i - 1];
    const res = classifyMove({
      uci: m.uci,
      san: m.san,
      from: m.from,
      to: m.to,
      color: m.color,
      piece: m.piece,
      captured: m.captured,
      promotion: m.promotion,
      fenBefore: m.fenBefore,
      fenAfter: m.fenAfter,
      before: evals[i],
      after: evals[i + 1],
      inBook: book.inBook,
      legalMoves: legalMoveCount(m.fenBefore),
      scoreBefore: scores[i],
      scoreAfter: scores[i + 1],
      prev: prevMove
        ? { to: parsed.moves[i - 1].to, captured: parsed.moves[i - 1].captured, loss: Math.max(0, prevMove.winBefore - prevMove.winAfter), winBeforeOpp: prevMove.winBefore }
        : undefined,
    });
    results.push(res);
    const top = evals[i].lines[0];
    const bestSan = top ? uciToSan(m.fenBefore, top.move) : undefined;
    const bestLine = top ? uciLineToSan(m.fenBefore, top.pv, 10).san : [];
    const replyLine = evals[i + 1]?.lines[0] ? uciLineToSan(m.fenAfter, evals[i + 1].lines[0].pv, 8).san : [];

    // Temps : pendule après le coup et temps passé
    let timeSpent: number | undefined;
    const prevSame = parsed.moves[i - 2];
    if (m.clock !== undefined) {
      const prevClock = prevSame?.clock ?? tc?.base;
      if (prevClock !== undefined) timeSpent = Math.max(0, prevClock - m.clock + (tc?.inc ?? 0));
    }

    const cpBefore = Math.max(-1000, Math.min(1000, povCp(res.scoreBefore, m.color)));
    const cpAfter = Math.max(-1000, Math.min(1000, povCp(res.scoreAfter, m.color)));

    moves.push({
      ply: i,
      san: m.san,
      uci: m.uci,
      color: m.color,
      piece: m.piece,
      captured: m.captured,
      fenBefore: m.fenBefore,
      fenAfter: m.fenAfter,
      classification: res.classification,
      evalBefore: res.scoreBefore,
      evalAfter: res.scoreAfter,
      bestMove: top?.move,
      bestSan,
      bestLine,
      replyLine,
      winBefore: res.winBefore,
      winAfter: res.winAfter,
      accuracy: acc.perMove[i] ?? 100,
      cpLoss: Math.max(0, cpBefore - cpAfter),
      clock: m.clock,
      timeSpent,
      comment: coachComment({ ply: i, san: m.san, bestSan, opening: currentOpening, res }),
      tags: res.tags,
      opening: book.inBook ? currentOpening : undefined,
      sacrifice: res.sacrifice ? { square: res.sacrifice.square, piece: res.sacrifice.piece } : undefined,
    });
  });

  const ratingOf = (color: Color) => {
    const r = Number(parsed.headers[color === 'w' ? 'WhiteElo' : 'BlackElo']);
    return Number.isFinite(r) && r > 0 ? r : undefined;
  };

  const summarize = (color: Color): PlayerSummary => {
    const mine = moves.filter((m) => m.color === color);
    const counts = EMPTY_COUNTS();
    for (const m of mine) counts[m.classification]++;
    const acpl = mine.length ? mine.reduce((s, m) => s + Math.min(1000, m.cpLoss), 0) / mine.length : 0;
    const accuracy = acc[color] ?? 0;
    const byPhase = { opening: [] as number[], middlegame: [] as number[], endgame: [] as number[] };
    const defense: number[] = [];
    const conversion: number[] = [];
    let tacticsFound = 0;
    let tacticsMissed = 0;
    let ttErrors = 0;
    let ttMoves = 0;
    const errorPieces: PlayerSummary['errorPieces'] = {};
    const lowClock = tc ? Math.max(15, tc.base * 0.1) : 20;
    for (const m of mine) {
      const phase = m.ply < phases.middlegame ? 'opening' : m.ply < phases.endgame ? 'middlegame' : 'endgame';
      if (m.classification !== 'book' && m.classification !== 'forced') byPhase[phase].push(m.accuracy);
      if (m.winBefore < 40) defense.push(m.accuracy);
      if (m.winBefore > 75) conversion.push(m.accuracy);
      const bad = m.classification === 'mistake' || m.classification === 'blunder' || m.classification === 'miss';
      if (m.tags.includes('opportunity') && m.classification !== 'book') {
        if (bad || m.classification === 'inaccuracy') tacticsMissed++;
        else tacticsFound++;
      }
      if (m.clock !== undefined && m.clock < lowClock) {
        ttMoves++;
        if (bad) ttErrors++;
      }
      if (bad) errorPieces[m.piece] = (errorPieces[m.piece] ?? 0) + 1;
    }
    const wins = mine.map((m) => m.winAfter);
    return {
      accuracy,
      acpl,
      estimatedElo: eloFromSummary({ accuracy, acpl, moves: mine.length, counts }, ratingOf(color)),
      moves: mine.length,
      counts,
      phaseAccuracy: {
        opening: phaseAccuracy(byPhase.opening) ?? (byPhase.opening.length ? byPhase.opening[0] : undefined),
        middlegame: phaseAccuracy(byPhase.middlegame),
        endgame: phaseAccuracy(byPhase.endgame),
      },
      defenseAccuracy: phaseAccuracy(defense),
      conversionAccuracy: phaseAccuracy(conversion),
      tacticsFound,
      tacticsMissed,
      timeTroubleErrors: ttErrors,
      timeTroubleMoves: ttMoves,
      errorPieces,
      maxWin: wins.length ? Math.max(...wins) : 50,
      minWin: wins.length ? Math.min(...wins) : 50,
    };
  };

  const white = summarize('w');
  const black = summarize('b');
  const names = { w: parsed.headers.White || 'Les Blancs', b: parsed.headers.Black || 'Les Noirs' };
  return {
    gameId,
    depth,
    createdAt: Date.now(),
    startFen: parsed.fens[0],
    moves,
    evals: scores,
    opening,
    phases,
    summary: { depth, analyzedAt: Date.now(), white, black, eloModel: ELO_MODEL_VERSION },
    coachIntro: coachIntro(moves, white, black, parsed.result, names),
  };
}

export async function analyzeGame(gameId: string, pgn: string, opts: AnalyzeGameOptions): Promise<GameAnalysis> {
  const parsed = parseGame(pgn);
  await loadOpenings();
  const { bookPlies } = identifyOpening(parsed.fens);
  const evals = await evaluatePositions(parsed, bookPlies, opts);
  return buildAnalysis(gameId, parsed, evals, opts.depth);
}
