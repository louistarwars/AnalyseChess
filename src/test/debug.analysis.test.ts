import { it } from 'vitest';
import { FAMOUS_GAMES } from '../data/famousGames';
import { analyzeGame } from '../lib/analysis';
import { formatScore } from '../lib/evaluation';
import { createNodeEngine } from './nodeEngine';

it.skipIf(process.env.ANALYSIS !== '1')('debug', async () => {
  const g = FAMOUS_GAMES.find((x) => x.id === process.env.GAME)!;
  const a = await analyzeGame(g.id, g.pgn, { depth: Number(process.env.DEPTH ?? 14), engine: createNodeEngine() });
  for (const m of a.moves)
    console.log(
      `${m.ply}`.padStart(3),
      m.san.padEnd(7),
      m.classification.padEnd(10),
      formatScore(m.evalBefore).padStart(6),
      formatScore(m.evalAfter).padStart(6),
      `w ${m.winBefore.toFixed(0)}→${m.winAfter.toFixed(0)}`.padEnd(10),
      `acc ${m.accuracy.toFixed(0)}`.padEnd(8),
      `cpl ${m.cpLoss.toFixed(0)}`.padEnd(9),
      `best ${m.bestSan}`.padEnd(12),
      m.tags.join(','),
    );
}, 600000);
