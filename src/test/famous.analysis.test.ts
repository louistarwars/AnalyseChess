import { describe, expect, it } from 'vitest';
import { FAMOUS_GAMES } from '../data/famousGames';
import { analyzeGame } from '../lib/analysis';
import { createNodeEngine } from './nodeEngine';

const RUN = process.env.ANALYSIS === '1';
const DEPTH = Number(process.env.DEPTH ?? 14);

describe.skipIf(!RUN)('analyse des parties célèbres (moteur réel)', () => {
  const engine = createNodeEngine();
  for (const g of FAMOUS_GAMES.filter((x) => !process.env.GAME || x.id === process.env.GAME)) {
    it(g.title, async () => {
      const a = await analyzeGame(g.id, g.pgn, { depth: DEPTH, engine });
      const line = a.moves
        .map((m) => `${m.ply % 2 === 0 ? Math.floor(m.ply / 2) + 1 + '.' : ''}${m.san}[${m.classification.slice(0, 5)}]`)
        .join(' ');
      console.log(`\n=== ${g.title} — ${a.opening?.name}\n${line}`);
      console.log('W', JSON.stringify({ acc: a.summary.white.accuracy.toFixed(1), elo: a.summary.white.estimatedElo, acpl: a.summary.white.acpl.toFixed(0), ...a.summary.white.counts }));
      console.log('B', JSON.stringify({ acc: a.summary.black.accuracy.toFixed(1), elo: a.summary.black.estimatedElo, acpl: a.summary.black.acpl.toFixed(0), ...a.summary.black.counts }));
      console.log('Coach:', a.coachIntro);
      for (const m of a.moves.filter((m) => ['brilliant', 'great', 'blunder', 'miss', 'mistake'].includes(m.classification))) console.log('  ', m.comment);
      expect(a.moves.length).toBeGreaterThan(10);
    }, 600000);
  }
});
