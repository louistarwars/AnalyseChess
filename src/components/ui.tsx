import { useEffect, useState, type ReactNode } from 'react';
import { formatSan, splitSan } from '../lib/notation';
import { pieceUrl } from '../lib/themes';
import { useSettings } from '../store/settings';

/** Coup en notation SAN, avec figurines si activées. */
export function San({ san, className }: { san: string; color?: 'w' | 'b'; className?: string }) {
  const { notation, pieceSet } = useSettings();
  // En thème sombre, les figurines sont toujours dessinées en blanc (comme sur chess.com).
  const color = 'w';
  if (notation !== 'figurine') return <span className={className}>{formatSan(san, notation)}</span>;
  const { piece, rest, promo } = splitSan(san);
  const parts = promo ? rest.split('=') : [rest];
  return (
    <span className={`san ${className ?? ''}`}>
      {piece && <img className="fig" src={pieceUrl(pieceSet, color, piece)} alt={piece} />}
      {parts[0]}
      {promo && (
        <>
          =<img className="fig" src={pieceUrl(pieceSet, color, promo)} alt={promo} />
          {parts[1]}
        </>
      )}
    </span>
  );
}

export function ChesscomLogo({ size = 20 }: { size?: number }) {
  return (
    <span className="platform-dot" style={{ width: size, height: size, background: 'linear-gradient(160deg, #95c95a, #6b9a3c)', borderRadius: size * 0.3 }}>
      <img src="pieces/cburnett/wP.svg" alt="Chess.com" style={{ width: size * 0.8, height: size * 0.8 }} />
    </span>
  );
}

export function LichessLogo({ size = 20 }: { size?: number }) {
  return (
    <span className="platform-dot" style={{ width: size, height: size, background: 'linear-gradient(160deg, #ffffff, #d9d9d9)', borderRadius: size * 0.3 }}>
      <img src="pieces/cburnett/bN.svg" alt="Lichess" style={{ width: size * 0.8, height: size * 0.8 }} />
    </span>
  );
}

export function PlatformLogo({ platform, size = 20 }: { platform: 'chesscom' | 'lichess' | 'pgn'; size?: number }) {
  if (platform === 'chesscom') return <ChesscomLogo size={size} />;
  if (platform === 'lichess') return <LichessLogo size={size} />;
  return (
    <span className="platform-dot" style={{ width: size, height: size, background: 'linear-gradient(160deg, #3a4254, #232937)', borderRadius: size * 0.3, fontSize: size * 0.3, fontWeight: 800, letterSpacing: '-0.02em' }}>
      PGN
    </span>
  );
}

const AVATAR_COLORS = ['#5b8bd4', '#1bb9a0', '#c46bd8', '#e8844a', '#81b64c', '#d8a23b', '#e05b7a', '#4bb3d6'];

export function Avatar({ name, src, size = 44, radius }: { name: string; src?: string; size?: number; radius?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const color = AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const style = { width: size, height: size, borderRadius: radius ?? size * 0.32, fontSize: size * 0.38 };
  if (src && !broken) return <img className="avatar" src={src} style={style} onError={() => setBroken(true)} alt="" />;
  return (
    <div className="avatar" style={{ ...style, background: `linear-gradient(145deg, ${color}, ${color}99)` }}>
      {initials || '?'}
    </div>
  );
}

/** Anneau de progression / précision animé. */
export function Ring({ value, size = 64, stroke = 6, color = 'var(--accent-hi)', children, track = 'rgba(255,255,255,0.08)' }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode; track?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, v)) / 100)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  );
}

/** Nombre animé (compteur). */
export function CountUp({ value, decimals = 0, duration = 900 }: { value: number; decimals?: number; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setV(value * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{v.toFixed(decimals).replace('.', ',')}</>;
}

export function accuracyColor(acc: number): string {
  if (acc >= 90) return 'var(--c-brilliant)';
  if (acc >= 80) return 'var(--c-best)';
  if (acc >= 70) return 'var(--c-good)';
  if (acc >= 60) return 'var(--c-inaccuracy)';
  if (acc >= 50) return 'var(--c-mistake)';
  return 'var(--c-blunder)';
}

export function AccuracyPill({ value }: { value?: number }) {
  if (value === undefined) return null;
  return (
    <span className="acc-pill num" style={{ color: accuracyColor(value), borderColor: 'currentColor' }}>
      {value.toFixed(1).replace('.', ',')}
    </span>
  );
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="grabber" />
        {children}
      </div>
    </>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} />;
}

/** Courbe simple (Elo, précision…). */
export function LineChart({
  points,
  height = 140,
  color = '#9bd35f',
  yFormat = (v: number) => String(Math.round(v)),
  band,
}: {
  points: { x: number; y: number }[];
  height?: number;
  color?: string;
  yFormat?: (v: number) => string;
  band?: number;
}) {
  if (points.length < 2) return <div className="dim small" style={{ height, display: 'grid', placeItems: 'center' }}>Pas encore assez de données</div>;
  const W = 340;
  const H = height;
  const padL = 36;
  const padR = 8;
  const padT = 12;
  const padB = 18;
  const ysVals = points.map((p) => p.y);
  let min = Math.min(...ysVals);
  let max = Math.max(...ysVals);
  const span = Math.max(max - min, band ?? 1);
  min -= span * 0.15;
  max += span * 0.15;
  const x0 = points[0].x;
  const x1 = points[points.length - 1].x;
  const X = (x: number) => padL + ((x - x0) / Math.max(1, x1 - x0)) * (W - padL - padR);
  const Y = (y: number) => padT + (1 - (y - min) / (max - min)) * (H - padT - padB);
  let d = '';
  points.forEach((p, i) => {
    const x = X(p.x);
    const y = Y(p.y);
    if (i === 0) d = `M${x},${y}`;
    else {
      const px = X(points[i - 1].x);
      const py = Y(points[i - 1].y);
      const mx = (px + x) / 2;
      d += ` C${mx},${py} ${mx},${y} ${x},${y}`;
    }
  });
  const area = `${d} L${X(x1)},${H - padB} L${X(x0)},${H - padB} Z`;
  const ticks = [min + (max - min) * 0.2, min + (max - min) * 0.5, min + (max - min) * 0.8];
  const gid = `lc${color.replace(/[^a-z0-9]/gi, '')}`;
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} stroke="rgba(255,255,255,0.06)" />
          <text x={padL - 6} y={Y(t) + 4} textAnchor="end" fontSize="10" fill="#7d8699" fontFamily="Outfit Variable, sans-serif">
            {yFormat(t)}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" className="draw-line" />
      <circle cx={X(last.x)} cy={Y(last.y)} r="4.5" fill={color} stroke="#0b0d12" strokeWidth="2" />
    </svg>
  );
}

/** Graphique radar des compétences. */
export function Radar({ items, size = 280 }: { items: { label: string; score: number }[]; size?: number }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnim(1));
    return () => cancelAnimationFrame(id);
  }, []);
  if (items.length < 3) return null;
  const c = size / 2;
  const R = size / 2 - 46;
  const angle = (i: number) => -Math.PI / 2 + (i / items.length) * Math.PI * 2;
  const pt = (i: number, r: number) => [c + Math.cos(angle(i)) * r, c + Math.sin(angle(i)) * r];
  const poly = items.map((it, i) => pt(i, (R * it.score * anim) / 100).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: size, display: 'block', margin: '0 auto' }}>
      <defs>
        <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9bd35f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#26c2a3" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={items.map((_, i) => pt(i, R * k).join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,0.08)" />
      ))}
      {items.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" />;
      })}
      <polygon points={poly} fill="url(#radarFill)" stroke="#9bd35f" strokeWidth="2" strokeLinejoin="round" style={{ transition: 'all 1s cubic-bezier(0.2, 0.8, 0.2, 1)' }} />
      {items.map((it, i) => {
        const [x, y] = pt(i, (R * it.score * anim) / 100);
        const [lx, ly] = pt(i, R + 24);
        return (
          <g key={it.label}>
            <circle cx={x} cy={y} r="3.5" fill="#9bd35f" style={{ transition: 'all 1s cubic-bezier(0.2, 0.8, 0.2, 1)' }} />
            <text x={lx} y={ly - 4} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#b4bccb" fontFamily="Inter Variable, sans-serif">
              {it.label}
            </text>
            <text x={lx} y={ly + 10} textAnchor="middle" fontSize="12" fontWeight="800" fill="#eef1f7" fontFamily="Outfit Variable, sans-serif">
              {it.score}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function timeClassLabel(tc: string): string {
  return { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapide', classical: 'Classique', daily: 'Par jour', unknown: 'Partie' }[tc] ?? tc;
}

export function formatDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = (now.getTime() - ts) / 86400000;
  if (diff < 1 && d.getDate() === now.getDate()) return "Aujourd'hui";
  if (diff < 2) return 'Hier';
  if (diff < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}
