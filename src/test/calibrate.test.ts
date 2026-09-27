import { Chess } from 'chess.js';
import { it } from 'vitest';
import { analyzeGame } from '../lib/analysis';
import { createNodeEngine } from './nodeEngine';

// Simulation de joueurs « humains » : Stockfish choisit parfois des coups faibles
// avec des fréquences typiques d'un niveau donné. Sert à calibrer l'estimation Elo.
const LEVELS = [
  { name: '~800', pb: 0.075, pm: 0.14, pi: 0.2 },
  { name: '~1100', pb: 0.05, pm: 0.11, pi: 0.18 },
  { name: '~1500', pb: 0.028, pm: 0.08, pi: 0.16 },
  { name: '~2000', pb: 0.012, pm: 0.05, pi: 0.14 },
  { name: '~2500', pb: 0.004, pm: 0.025, pi: 0.1 },
];

let seed = 12345;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

it.skipIf(process.env.CALIB !== '1')('calibration Elo', async () => {
  const player = createNodeEngine();
  const analyst = createNodeEngine();
  const GAMES = Number(process.env.GAMES ?? 6);
  for (const lvl of LEVELS) {
    const rows: string[] = [];
    for (let g = 0; g < GAMES; g++) {
      const c = new Chess();
      while (!c.isGameOver() && c.history().length < 110) {
        const ev = await player.analyze(c.fen(), { depth: 7, multiPv: 5 }).promise;
        const ranked = ev.lines.map((l) => l.move);
        const legal = c.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
        let uci = ranked[0];
        const r = rnd();
        if (c.history().length < 6) uci = ranked[Math.floor(rnd() * Math.min(3, ranked.length))];
        else if (r < lvl.pb) {
          const others = legal.filter((m) => !ranked.includes(m));
          uci = others.length ? others[Math.floor(rnd() * others.length)] : ranked[ranked.length - 1];
        } else if (r < lvl.pb + lvl.pm) uci = ranked[Math.min(ranked.length - 1, 2 + Math.floor(rnd() * 3))];
        else if (r < lvl.pb + lvl.pm + lvl.pi) uci = ranked[Math.min(ranked.length - 1, 1)];
        c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      }
      const a = await analyzeGame('sim' + g, c.pgn(), { depth: 12, engine: analyst });
      for (const s of [a.summary.white, a.summary.black]) {
        rows.push(
          [s.accuracy.toFixed(1), s.acpl.toFixed(0), s.moves, s.counts.blunder, s.counts.mistake, s.counts.miss, s.counts.inaccuracy, s.estimatedElo].join(','),
        );
      }
    }
    console.log(`LEVEL ${lvl.name}\n` + rows.join('\n'));
  }
}, 3600000);
