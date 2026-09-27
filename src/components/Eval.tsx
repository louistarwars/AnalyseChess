import { useRef } from 'react';
import { evalBarPercent, formatScore, winPercent } from '../lib/evaluation';
import type { Classification, Score } from '../lib/types';
import { CLASS_HEX } from './ClassIcon';
import { useIsManga } from '../lib/theme';
import { mangaColor } from './manga';

/** Barre d'évaluation verticale (façon chess.com). */
export function EvalBar({ score, orientation = 'w', result }: { score?: Score; orientation?: 'w' | 'b'; result?: string }) {
  const pct = score ? evalBarPercent(score) : 50;
  const whiteAdv = score ? score.cp >= 0 : true;
  const label = result && score?.mate === 0 ? result.replace('1/2-1/2', '½-½') : score ? formatScore(score, true).replace('+', '').replace('-', '') : '0.0';
  const flipped = orientation === 'b';
  return (
    <div className={`evalbar ${flipped ? 'flipped' : ''}`}>
      <div className="evalbar-white" style={{ height: `${pct}%` }} />
      <span className={`evalbar-label ${whiteAdv ? 'white-side' : 'black-side'}`}>{label}</span>
    </div>
  );
}

interface GraphProps {
  evals: Score[];
  current: number;
  onSelect?: (ply: number) => void;
  markers?: { ply: number; cls: Classification }[];
  height?: number;
  phases?: { middlegame: number; endgame: number };
}

/** Graphique d'évaluation interactif (zone blanche = avantage blanc). */
export function EvalGraph({ evals, current, onSelect, markers = [], height = 86, phases }: GraphProps) {
  const ref = useRef<SVGSVGElement>(null);
  const manga = useIsManga();
  const n = evals.length;
  const W = 400;
  const H = 100;
  const xs = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const ys = (s: Score) => {
    const w = winPercent(s, 'w');
    return H - (Math.max(2, Math.min(98, w)) / 100) * H;
  };
  const pts = evals.map((s, i) => [xs(i), ys(s)] as const);
  let d = '';
  pts.forEach(([x, y], i) => {
    if (i === 0) d += `M${x},${y}`;
    else {
      const [px, py] = pts[i - 1];
      const mx = (px + x) / 2;
      d += ` C${mx},${py} ${mx},${y} ${x},${y}`;
    }
  });
  const area = `${d} L${W},${H} L0,${H} Z`;

  const select = (clientX: number) => {
    const el = ref.current;
    if (!el || !onSelect || n < 2) return;
    const r = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onSelect(Math.round(t * (n - 1)));
  };

  const cx = xs(Math.min(current, n - 1));
  const cur = pts[Math.min(current, n - 1)];
  return (
    <div
      className="evalgraph"
      style={{ height }}
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        select(e.clientX);
      }}
      onPointerMove={(e) => e.buttons && select(e.clientX)}
    >
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="egWhite" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#d9dee7" />
          </linearGradient>
        </defs>
        {!manga && <rect x="0" y="0" width={W} height={H} fill="#262b36" />}
        {phases && phases.middlegame < n && (
          <rect x={xs(phases.middlegame)} y="0" width={Math.max(0, xs(Math.min(phases.endgame, n - 1)) - xs(phases.middlegame))} height={H} fill="rgba(255,255,255,0.03)" />
        )}
        {n > 1 && <path d={area} fill={manga ? '#fffdf6' : 'url(#egWhite)'} />}
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke={manga ? '#e8322b' : 'rgba(120,130,150,0.6)'} strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        {n > 1 && <path d={d} fill="none" stroke={manga ? '#141414' : '#7d8799'} strokeWidth={manga ? 2.5 : 1.2} vectorEffect="non-scaling-stroke" />}
        <line x1={cx} y1="0" x2={cx} y2={H} stroke={manga ? '#e8322b' : '#9bd35f'} strokeWidth={manga ? 2.5 : 2} vectorEffect="non-scaling-stroke" />
      </svg>
      {markers.map((m) => {
        const p = pts[m.ply + 1];
        if (!p) return null;
        return <span key={m.ply} className="eg-marker" style={{ left: `${(p[0] / W) * 100}%`, top: `${(p[1] / H) * 100}%`, background: manga ? mangaColor(m.cls) : CLASS_HEX[m.cls] }} />;
      })}
      {cur && <span className="eg-current" style={{ left: `${(cur[0] / W) * 100}%`, top: `${(cur[1] / H) * 100}%` }} />}
    </div>
  );
}
