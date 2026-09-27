import { Chess } from 'chess.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { gameAccuracy, moveAccuracy } from './accuracy';
import { buildAnalysis } from './analysis';
import { classifyMove, type MoveContext } from './classify';
import { aggregateElo, estimateElo, projectRating } from './elo';
import { fromUci, winPercent } from './evaluation';
import { computeInsights } from './insights';
import { identifyOpening, loadOpenings } from './openings';
import { parseGame } from './pgn';
import { detectSacrifice, hangingPieces, seeGain } from './tactics';
import type { PositionEval, Score, StoredGame } from './types';

const ev = (fen: string, lines: { move: string; cp?: number; mate?: number }[]): PositionEval => ({
  fen,
  depth: 14,
  lines: lines.map((l) => ({ move: l.move, pv: [l.move], depth: 14, score: l.mate !== undefined ? { cp: Math.sign(l.mate) * (10000 - Math.abs(l.mate)), mate: l.mate } : { cp: l.cp ?? 0 } })),
});

function ctxFor(fenBefore: string, san: string, before: PositionEval, after: PositionEval, extra: Partial<MoveContext> = {}): MoveContext {
  const c = new Chess(fenBefore);
  const m = c.move(san);
  return {
    uci: m.from + m.to + (m.promotion ?? ''),
    san: m.san,
    from: m.from,
    to: m.to,
    color: m.color,
    piece: m.piece,
    captured: m.captured,
    promotion: m.promotion,
    fenBefore,
    fenAfter: m.after,
    before: { ...before, fen: fenBefore },
    after: { ...after, fen: m.after },
    inBook: false,
    legalMoves: new Chess(fenBefore).moves().length,
    ...extra,
  };
}

describe('évaluation et précision', () => {
  it('convertit les scores UCI du point de vue des Blancs', () => {
    expect(fromUci('cp', 50, 'b')).toEqual({ cp: -50 });
    expect(fromUci('mate', 3, 'b').mate).toBe(-3);
    expect(winPercent({ cp: 0 }, 'w')).toBeCloseTo(50);
    expect(winPercent({ cp: 10000, mate: 2 }, 'b')).toBe(0);
  });

  it('précision par coup', () => {
    expect(moveAccuracy(60, 60)).toBe(100);
    expect(moveAccuracy(60, 70)).toBe(100);
    expect(moveAccuracy(80, 20)).toBeLessThan(15);
    expect(moveAccuracy(55, 50)).toBeGreaterThan(80);
  });

  it('précision de partie entre 0 et 100, meilleure pour le joueur sans erreur', () => {
    const evals: Score[] = [{ cp: 20 }, { cp: 25 }, { cp: 20 }, { cp: 30 }, { cp: 400 }, { cp: 410 }, { cp: 390 }, { cp: 900 }];
    const acc = gameAccuracy(evals, 'w');
    expect(acc.w).toBeGreaterThan(90);
    expect(acc.b).toBeLessThan(acc.w!);
    expect(acc.perMove).toHaveLength(7);
  });
});

describe('Elo', () => {
  it('est croissant avec la précision', () => {
    const base = { acpl: 40, moves: 35, blunders: 0, mistakes: 1 };
    const a = estimateElo({ ...base, accuracy: 70 });
    const b = estimateElo({ ...base, accuracy: 85 });
    const c = estimateElo({ ...base, accuracy: 95, acpl: 10 });
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThanOrEqual(3300);
  });

  it('agrège et projette', () => {
    const agg = aggregateElo([
      { elo: 1500, moves: 30, timestamp: 3 },
      { elo: 1600, moves: 30, timestamp: 2 },
      { elo: 1400, moves: 30, timestamp: 1 },
    ])!;
    expect(agg.elo).toBeGreaterThan(1400);
    expect(agg.elo).toBeLessThan(1600);
    const day = 86400000;
    const proj = projectRating(Array.from({ length: 10 }, (_, i) => ({ t: i * day, r: 1500 + i * 3 })))!;
    expect(proj.slopePerMonth).toBe(90);
    expect(proj.projected).toBeGreaterThan(1520);
  });
});

describe('tactique', () => {
  it('SEE : une dame attaquée par un pion est perdue', () => {
    const c = new Chess('4k3/8/8/3p4/4Q3/8/8/4K3 b - - 0 1');
    expect(seeGain(c, 'e4')).toBe(9);
    const d = new Chess('4k3/8/3p4/4p3/3P4/8/8/4K3 w - - 0 1');
    expect(seeGain(d, 'e5')).toBe(0); // pion défendu : dxe5 dxe5 = échange égal
  });

  it('détecte le sacrifice de tour 13.Txd7!! (partie de l’Opéra)', () => {
    const c = new Chess();
    'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8'.split(' ').forEach((m) => c.move(m));
    const before = c.fen();
    const m = c.move('Rxd7');
    const sac = detectSacrifice(before, m.after, { to: m.to, piece: m.piece, captured: m.captured });
    expect(sac?.piece).toBe('r');
  });

  it('pièces en prise', () => {
    const h = hangingPieces('4k3/8/8/3p4/4N3/8/8/4K3 w - - 0 1', 'w', 3);
    expect(h[0]?.piece).toBe('n');
  });
});

describe('classification', () => {
  const start = new Chess().fen();

  it('coup forcé, meilleur coup, gaffe', () => {
    const forcedFen = '1r5k/8/8/8/8/8/8/K6r w - - 0 1'; // seul coup légal : Ra2
    const f = ctxFor(forcedFen, 'Ka2', ev(forcedFen, [{ move: 'a1a2', cp: -900 }]), ev('', [{ move: 'h1h2', cp: -900 }]));
    expect(classifyMove(f).classification).toBe('forced');

    const best = ctxFor(start, 'e4', ev(start, [{ move: 'e2e4', cp: 30 }, { move: 'd2d4', cp: 28 }]), ev('', [{ move: 'e7e5', cp: 30 }]));
    expect(classifyMove(best).classification).toBe('best');

    const blunder = ctxFor(start, 'f3', ev(start, [{ move: 'e2e4', cp: 30 }]), ev('', [{ move: 'e7e5', cp: -700 }]));
    expect(classifyMove(blunder).classification).toBe('blunder');

    const inacc = ctxFor(start, 'a3', ev(start, [{ move: 'e2e4', cp: 30 }]), ev('', [{ move: 'e7e5', cp: -40 }]));
    expect(classifyMove(inacc).classification).toBe('inaccuracy');
  });

  it('coup théorique', () => {
    const c = ctxFor(start, 'e4', ev(start, [{ move: 'd2d4', cp: 30 }]), ev('', [{ move: 'e7e5', cp: 20 }]), { inBook: true });
    expect(classifyMove(c).classification).toBe('book');
  });

  it('mat manqué = occasion manquée', () => {
    // Les Blancs ont un mat en 1 (Dh7#) mais jouent un coup quelconque qui reste gagnant
    const fen = '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1';
    const c = ctxFor(fen, 'h3', ev(fen, [{ move: 'd1d8', mate: 1 }, { move: 'h2h3', cp: 900 }]), ev('', [{ move: 'g8h8', cp: 850 }]));
    expect(classifyMove(c).classification).toBe('miss');
  });
});

describe('analyse complète (évaluations simulées)', () => {
  beforeAll(async () => {
    await loadOpenings();
  });

  it('identifie l’ouverture et produit un bilan cohérent', () => {
    const parsed = parseGame('[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Qe2 Nd4 7. Nxd4 1-0');
    const { opening } = identifyOpening(parsed.fens);
    expect(opening?.name).toMatch(/espagnole/i);
    const evals: PositionEval[] = parsed.fens.map((fen, i) => {
      const next = parsed.moves[i];
      // En position 11, le moteur préfère 6...O-O : 6...Cd4 est donc une erreur (+3 pour les Blancs ensuite).
      return ev(fen, [{ move: i === 11 ? 'e8g8' : next?.uci ?? 'a2a3', cp: i >= 12 ? 300 : 25 }]);
    });
    const a = buildAnalysis('test', parsed, evals, 14);
    expect(a.moves).toHaveLength(13);
    expect(a.moves[0].classification).toBe('book');
    expect(a.moves[11].classification).toMatch(/mistake|blunder|miss|inaccuracy/);
    expect(a.summary.white.accuracy).toBeGreaterThan(a.summary.black.accuracy);
    expect(a.summary.white.estimatedElo).toBeGreaterThan(0);
    expect(a.coachIntro.length).toBeGreaterThan(10);
  });
});

describe('statistiques', () => {
  it('calcule bilan, ouvertures et compétences', () => {
    const summary = (acc: number) => ({
      accuracy: acc,
      acpl: 30,
      estimatedElo: 1500 + (acc - 75) * 30,
      moves: 30,
      counts: { brilliant: 0, great: 1, best: 10, excellent: 8, good: 5, book: 4, inaccuracy: 2, mistake: 1, miss: 1, blunder: 1, forced: 0 },
      phaseAccuracy: { opening: 85, middlegame: acc, endgame: 60 },
      defenseAccuracy: 70,
      conversionAccuracy: 80,
      tacticsFound: 3,
      tacticsMissed: 2,
      timeTroubleErrors: 1,
      timeTroubleMoves: 6,
      errorPieces: { q: 2 },
      maxWin: 90,
      minWin: 30,
    });
    const games: StoredGame[] = Array.from({ length: 6 }, (_, i) => ({
      id: 'g' + i,
      source: 'pgn',
      pgn: '',
      white: i % 2 ? 'x' : 'me',
      black: i % 2 ? 'me' : 'x',
      whiteElo: 1500 + i,
      blackElo: 1500 + i,
      result: i < 4 ? (i % 2 ? '0-1' : '1-0') : '1/2-1/2',
      timestamp: i * 1000,
      timeClass: 'blitz',
      opening: i % 2 ? 'Défense sicilienne : Najdorf' : 'Partie italienne',
      plies: 60,
      userColor: i % 2 ? 'b' : 'w',
      importedAt: 0,
      summary: { depth: 14, analyzedAt: 0, white: summary(80), black: summary(70) },
    }));
    const ins = computeInsights(games);
    expect(ins.totalGames).toBe(6);
    expect(ins.record).toEqual({ win: 4, draw: 2, loss: 0 });
    expect(ins.openings.w[0].name).toBe('Partie italienne');
    expect(ins.openings.b[0].name).toBe('Défense sicilienne');
    expect(ins.skills.length).toBeGreaterThanOrEqual(5);
    expect(ins.strengths.length + ins.weaknesses.length).toBeGreaterThan(0);
    expect(ins.estimatedElo).toBeDefined();
  });
});
