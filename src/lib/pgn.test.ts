import { describe, expect, it } from 'vitest';
import { FAMOUS_GAMES } from '../data/famousGames';
import { parseGame, parseMany, splitPgn, timeClassFromControl, gameTimestamp } from './pgn';
import { toFrenchSan } from './notation';

describe('pgn', () => {
  it('parse les parties célèbres sans erreur', () => {
    for (const g of FAMOUS_GAMES) {
      const p = parseGame(g.pgn);
      expect(p.moves.length).toBeGreaterThan(20);
      expect(p.result).not.toBe('*');
    }
  });

  it('lit les pendules, ignore variantes, commentaires et NAG', () => {
    const pgn = `[Event "Live Chess"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[TimeControl "180+2"]
[UTCDate "2024.03.05"]
[UTCTime "18:22:01"]

1. e4 {[%clk 0:03:01.9]} 1... e5 {[%clk 0:03:00.5]} 2. Nf3 $1 (2. Bc4 Nc6 (2... Nf6)) 2... Nc6 {Bon coup [%clk 0:02:58]} 3. Bb5!? a6 ; commentaire
4. Ba4 Nf6 5. 0-0 0-1`;
    const p = parseGame(pgn);
    expect(p.moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O']);
    expect(p.moves[0].clock).toBeCloseTo(181.9);
    expect(p.moves[3].clock).toBe(178);
    expect(p.result).toBe('0-1');
    expect(timeClassFromControl(p.headers.TimeControl)).toBe('blitz');
    expect(new Date(gameTimestamp(p.headers)).toISOString()).toBe('2024-03-05T18:22:01.000Z');
  });

  it('sépare plusieurs parties', () => {
    const text = FAMOUS_GAMES.map((g) => g.pgn).join('\n\n');
    expect(splitPgn(text)).toHaveLength(FAMOUS_GAMES.length);
    const { games, errors } = parseMany(text + '\n\n[Event "x"]\n\n1. e4 e5 2. Ke3 Qxz9 *');
    expect(games).toHaveLength(FAMOUS_GAMES.length + 0);
    expect(errors.length).toBe(1);
  });

  it('accepte un PGN sans en-têtes', () => {
    const p = parseGame('1. d4 d5 2. c4 e6 3. Nc3 Nf6');
    expect(p.moves).toHaveLength(6);
  });

  it('gère une position de départ FEN', () => {
    const p = parseGame('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1. e4 Kd7 *');
    expect(p.moves).toHaveLength(2);
  });

  it('notation française', () => {
    expect(toFrenchSan('Nxe5+')).toBe('Cxe5+');
    expect(toFrenchSan('exd8=Q#')).toBe('exd8=D#');
    expect(toFrenchSan('Kb1')).toBe('Rb1');
    expect(toFrenchSan('Rxb7')).toBe('Txb7');
    expect(toFrenchSan('Bb5')).toBe('Fb5');
  });
});
