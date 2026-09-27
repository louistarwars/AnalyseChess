import { pieceUrl } from '../lib/themes';
import { useSettings } from '../store/settings';
import { Avatar } from './ui';

const ORDER = ['q', 'r', 'b', 'n', 'p'] as const;
const VAL: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const START: Record<string, number> = { q: 1, r: 2, b: 2, n: 2, p: 8 };

/** Pièces capturées par `color` et avantage matériel. */
export function materialInfo(fen: string, color: 'w' | 'b'): { captured: string[]; diff: number } {
  const placement = fen.split(' ')[0];
  const count = { w: { q: 0, r: 0, b: 0, n: 0, p: 0 }, b: { q: 0, r: 0, b: 0, n: 0, p: 0 } } as Record<'w' | 'b', Record<string, number>>;
  for (const ch of placement) {
    const l = ch.toLowerCase();
    if (l in VAL) count[ch === l ? 'b' : 'w'][l]++;
  }
  const opp = color === 'w' ? 'b' : 'w';
  const captured: string[] = [];
  for (const p of ORDER) for (let i = 0; i < Math.max(0, START[p] - count[opp][p]); i++) captured.push(p);
  const mat = (c: 'w' | 'b') => ORDER.reduce((s, p) => s + count[c][p] * VAL[p], 0);
  return { captured, diff: mat(color) - mat(opp) };
}

function fmtClock(s?: number) {
  if (s === undefined) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  if (s < 20) return `${m}:${String(sec).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function PlayerBar({ name, elo, color, fen, clock, active, avatar }: { name: string; elo?: number; color: 'w' | 'b'; fen: string; clock?: number; active?: boolean; avatar?: string }) {
  const { pieceSet } = useSettings();
  const { captured, diff } = materialInfo(fen, color);
  const opp = color === 'w' ? 'b' : 'w';
  return (
    <div className="playerbar">
      <Avatar name={name} src={avatar} size={34} radius={9} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="pb-name ellipsis">{name}</span>
          {elo ? <span className="pb-elo">({elo})</span> : null}
        </div>
        <div className="pb-captured">
          {captured.map((p, i) => (
            <img key={i} src={pieceUrl(pieceSet, opp, p)} alt="" className={i > 0 && captured[i - 1] !== p ? 'gap' : ''} />
          ))}
          {diff > 0 && <span className="pb-diff">+{diff}</span>}
        </div>
      </div>
      {clock !== undefined && <div className={`pb-clock num ${color === 'w' ? 'light' : 'dark'} ${active ? 'active' : ''}`}>{fmtClock(clock)}</div>}
    </div>
  );
}
