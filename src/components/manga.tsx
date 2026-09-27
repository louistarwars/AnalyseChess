import { useMemo, type CSSProperties, type ReactNode } from 'react';
import type { Classification } from '../lib/types';

/* ------------------------------------------------------------------ */
/*  Primitives graphiques du thème Manga                               */
/* ------------------------------------------------------------------ */

function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Polygone en étoile / explosion (coordonnées dans un carré 0..size). */
export function burstPath(points: number, outer: number, inner: number, jitter = 0, seed = 1, size = 24, rotation = -Math.PI / 2): string {
  const r = seeded(seed);
  const c = size / 2;
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = rotation + (i / (points * 2)) * Math.PI * 2;
    const base = i % 2 === 0 ? outer : inner;
    const rad = base + (jitter ? (r() - 0.5) * 2 * jitter : 0);
    pts.push(`${(c + Math.cos(a) * rad).toFixed(2)},${(c + Math.sin(a) * rad).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** Lignes de vitesse radiales (effet « concentration » des mangas). */
export function SpeedLines({
  count = 90,
  color = '#141414',
  inner = 0.34,
  cx = 0.5,
  cy = 0.5,
  seed = 7,
  className,
  style,
}: {
  count?: number;
  color?: string;
  inner?: number;
  cx?: number;
  cy?: number;
  seed?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const paths = useMemo(() => {
    const r = seeded(seed);
    const out: string[] = [];
    const R = 1.6;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (r() - 0.5) * 0.05;
      const w = 0.004 + r() * 0.014;
      const start = inner * (0.75 + r() * 0.55);
      const x1 = cx + Math.cos(a) * start;
      const y1 = cy + Math.sin(a) * start;
      const xa = cx + Math.cos(a - w) * R;
      const ya = cy + Math.sin(a - w) * R;
      const xb = cx + Math.cos(a + w) * R;
      const yb = cy + Math.sin(a + w) * R;
      out.push(`M${x1.toFixed(4)},${y1.toFixed(4)}L${xa.toFixed(4)},${ya.toFixed(4)}L${xb.toFixed(4)},${yb.toFixed(4)}Z`);
    }
    return out.join('');
  }, [count, inner, cx, cy, seed]);
  return (
    <svg className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', ...style }} viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
      <path d={paths} fill={color} />
    </svg>
  );
}

/** Onomatopée façon manga (texte japonais épais, contour et ombre). */
export function Sfx({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={`sfx ${className ?? ''}`} style={style} aria-hidden>
      {children}
    </span>
  );
}

/** Tampon « hanko » (sceau japonais) pour les résultats. */
export function Hanko({ result }: { result: 'win' | 'loss' | 'draw' | 'unknown' }) {
  const k = result === 'win' ? '勝' : result === 'loss' ? '負' : result === 'draw' ? '引分' : '局';
  return (
    <span className={`hanko ${result}`} aria-label={result}>
      <span>{k}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Badges de classification en forme d'onomatopée                    */
/* ------------------------------------------------------------------ */

const SHAPES: Partial<Record<Classification, string>> = {
  brilliant: burstPath(14, 11.6, 8.4, 0.35, 3),
  great: burstPath(10, 11.3, 8.9, 0, 5),
  blunder: burstPath(9, 11.9, 6.9, 1.3, 11),
  mistake: burstPath(8, 11.4, 7.8, 0.9, 13),
  miss: burstPath(7, 11.5, 7.6, 1.1, 17),
  inaccuracy: burstPath(12, 11.2, 9.9, 0.2, 19),
};

const MANGA_HEX: Record<Classification, string> = {
  brilliant: '#12b39b',
  great: '#3c7ddb',
  best: '#5fa532',
  excellent: '#7fae34',
  good: '#93a882',
  book: '#b58558',
  inaccuracy: '#f5b800',
  mistake: '#f47f17',
  miss: '#f25a4a',
  blunder: '#e2231a',
  forced: '#8e9bab',
};

export function mangaColor(cls: Classification) {
  return MANGA_HEX[cls];
}

const SYMBOL: Partial<Record<Classification, string>> = {
  brilliant: '!!',
  great: '!',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

export function MangaClassGlyph({ cls, size = 20, className, shadow = true }: { cls: Classification; size?: number; className?: string; shadow?: boolean }) {
  const ink = '#141414';
  const shape = SHAPES[cls];
  const fill = MANGA_HEX[cls];
  const sym = SYMBOL[cls];
  const body = shape ? <path d={shape} /> : <circle cx="12" cy="12" r="10.3" />;
  const glyph = () => {
    const common = { fill: '#fff', stroke: ink, strokeWidth: 1.1, strokeLinejoin: 'round' as const, paintOrder: 'stroke' as const };
    if (sym) {
      const fs = sym.length > 1 ? 11.5 : 14;
      return (
        <text x="12" y="12.6" textAnchor="middle" dominantBaseline="central" fontFamily="Bangers, 'Dela Gothic One', sans-serif" fontSize={fs} letterSpacing={sym.length > 1 ? -0.4 : 0} {...common} strokeWidth={2.2}>
          {sym}
        </text>
      );
    }
    switch (cls) {
      case 'best':
        return <path d="M12 4.6l2.2 4.5 4.9.7-3.55 3.45.85 4.9L12 15.85l-4.4 2.3.85-4.9L4.9 9.8l4.9-.7z" {...common} />;
      case 'excellent':
        return <path d="M9 11l2.6-5.2c.9 0 1.6.7 1.6 1.6v2.4h3.2c.95 0 1.65.9 1.4 1.8l-1.05 4.4c-.17.68-.78 1.15-1.48 1.15H9zM6 11h1.8v6.15H6a.7.7 0 01-.7-.7V11.7c0-.39.31-.7.7-.7z" {...common} />;
      case 'good':
        return <path d="M6.6 12.3l3.5 3.4 7.3-7.4" fill="none" stroke="#fff" strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" />;
      case 'book':
        return <path d="M5.6 7.6c2.1-.8 4.3-.6 6.4.7 2.1-1.3 4.3-1.5 6.4-.7v9.3c-2.1-.7-4.3-.5-6.4.7-2.1-1.2-4.3-1.4-6.4-.7z" {...common} />;
      case 'miss':
        return <path d="M8.3 8.3l7.4 7.4M15.7 8.3l-7.4 7.4" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" />;
      case 'forced':
        return <path d="M6.5 12h9.2M12.6 8.2l3.8 3.8-3.8 3.8" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />;
      default:
        return null;
    }
  };
  return (
    <svg width={size} height={size} viewBox="-1 -1 27 27" className={className} style={{ flexShrink: 0, overflow: 'visible' }}>
      {shadow && (
        <g transform="translate(1.6 1.8)" fill={ink}>
          {body}
        </g>
      )}
      <g fill={fill} stroke={ink} strokeWidth={1.7} strokeLinejoin="round">
        {body}
      </g>
      {glyph()}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Coach (cavalier) avec marques d'émotion manga                      */
/* ------------------------------------------------------------------ */

export type Mood = 'happy' | 'wow' | 'ok' | 'worried' | 'shock' | 'think' | 'neutral';

export function moodFor(cls?: Classification): Mood {
  switch (cls) {
    case 'brilliant':
    case 'great':
      return 'wow';
    case 'best':
    case 'excellent':
      return 'happy';
    case 'good':
    case 'book':
    case 'forced':
      return 'ok';
    case 'inaccuracy':
      return 'think';
    case 'mistake':
    case 'miss':
      return 'worried';
    case 'blunder':
      return 'shock';
    default:
      return 'neutral';
  }
}

function MoodMarks({ mood }: { mood: Mood }) {
  const ink = '#141414';
  switch (mood) {
    case 'wow':
      return (
        <g>
          <path d="M78 10l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#ffd400" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M91 34l1.6 4.2 4.2 1.6-4.2 1.6L91 45.6l-1.6-4.2-4.2-1.6 4.2-1.6z" fill="#fff" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
        </g>
      );
    case 'happy':
      return <path d="M82 14l2.4 6.2 6.2 2.4-6.2 2.4L82 31.2l-2.4-6.2-6.2-2.4 6.2-2.4z" fill="#fff" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />;
    case 'think':
      return (
        <g fill="#fff" stroke={ink} strokeWidth="1.8">
          <circle cx="84" cy="30" r="3" />
          <circle cx="90" cy="20" r="4.4" />
          <text x="90" y="24" textAnchor="middle" fontFamily="Bangers, sans-serif" fontSize="9" fill={ink} stroke="none">
            ?
          </text>
        </g>
      );
    case 'worried':
      // goutte de sueur
      return <path d="M86 12c4 7 7 10.5 7 14.5a7 7 0 01-14 0c0-4 3-7.5 7-14.5z" fill="#8fd3ff" stroke={ink} strokeWidth="2" />;
    case 'shock':
      return (
        <g>
          <path d="M84 8c3.4 6 6 9 6 12.4a6 6 0 01-12 0C78 17 80.6 14 84 8z" fill="#8fd3ff" stroke={ink} strokeWidth="2" />
          <path d="M8 22l10 4M6 34l11 1M10 46l9-4" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M92 36l-8 5M95 48l-10 1" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'ok':
      return (
        <path d="M84 16c1.5-3 6-3 6 1 0 3-6 7-6 7s-6-4-6-7c0-4 4.5-4 6-1z" fill="#ff6b8b" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
      );
    default:
      return null;
  }
}

/** Avatar du coach : cavalier dans une case de manga, avec trame et émotion. */
export function CoachMascot({ mood = 'neutral', size = 56 }: { mood?: Mood; size?: number }) {
  return (
    <div className={`coach-mascot mood-${mood}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <defs>
          <pattern id="mascotTone" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1.1" fill="#141414" opacity="0.35" />
          </pattern>
        </defs>
        <circle cx="50" cy="54" r="42" fill="#fffdf7" stroke="#141414" strokeWidth="4" />
        <circle cx="50" cy="54" r="40" fill={mood === 'shock' ? '#ffd6d0' : mood === 'wow' ? '#d6f7ef' : 'url(#mascotTone)'} opacity={mood === 'shock' || mood === 'wow' ? 1 : 0.8} />
        {mood === 'wow' && <path d="M50 54m-40 0a40 40 0 1080 0a40 40 0 10-80 0" fill="url(#mascotTone)" opacity="0.25" />}
        <image href="pieces/cburnett/wN.svg" x="18" y="20" width="64" height="64" />
        <MoodMarks mood={mood} />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Case d'impact (coups brillants, gaffes, mat…)                      */
/* ------------------------------------------------------------------ */

export interface ImpactSpec {
  sfx: string;
  label: string;
  color: string;
  tone: 'bright' | 'dark';
}

export function impactFor(cls: Classification, tags: string[]): ImpactSpec | null {
  if (tags.includes('checkmate')) return { sfx: '詰み!', label: 'ÉCHEC ET MAT !', color: '#e2231a', tone: 'dark' };
  switch (cls) {
    case 'brilliant':
      return { sfx: '神の一手', label: 'BRILLANT !!', color: '#12b39b', tone: 'bright' };
    case 'great':
      return { sfx: 'キラッ!', label: 'TRÈS BON COUP !', color: '#3c7ddb', tone: 'bright' };
    case 'blunder':
      return { sfx: 'ガーン!!', label: 'GAFFE ??', color: '#e2231a', tone: 'dark' };
    case 'miss':
      return { sfx: 'スカッ', label: 'OCCASION MANQUÉE', color: '#f25a4a', tone: 'dark' };
    default:
      return null;
  }
}

export function ImpactFrame({ spec }: { spec: ImpactSpec }) {
  return (
    <div className={`impact-frame ${spec.tone}`} style={{ ['--impact' as string]: spec.color }} aria-hidden>
      <SpeedLines count={110} color={spec.tone === 'dark' ? '#141414' : '#141414'} inner={0.28} seed={spec.sfx.length * 13} className="impact-lines" />
      <div className="impact-text">
        <Sfx className={`impact-sfx ${/[\u4e00-\u9fff]/.test(spec.sfx) ? 'kanji' : ''}`}>{spec.sfx}</Sfx>
        <div className="impact-label">{spec.label}</div>
      </div>
    </div>
  );
}
