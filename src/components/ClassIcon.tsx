import type { Classification } from '../lib/types';

export const CLASS_META: Record<Classification, { label: string; plural: string; color: string; symbol?: string }> = {
  brilliant: { label: 'Brillant', plural: 'Brillants', color: 'var(--c-brilliant)', symbol: '!!' },
  great: { label: 'Très bon coup', plural: 'Très bons coups', color: 'var(--c-great)', symbol: '!' },
  best: { label: 'Meilleur coup', plural: 'Meilleurs coups', color: 'var(--c-best)' },
  excellent: { label: 'Excellent', plural: 'Excellents', color: 'var(--c-excellent)' },
  good: { label: 'Bon coup', plural: 'Bons coups', color: 'var(--c-good)' },
  book: { label: 'Théorique', plural: 'Théoriques', color: 'var(--c-book)' },
  inaccuracy: { label: 'Imprécision', plural: 'Imprécisions', color: 'var(--c-inaccuracy)', symbol: '?!' },
  mistake: { label: 'Erreur', plural: 'Erreurs', color: 'var(--c-mistake)', symbol: '?' },
  miss: { label: 'Occasion manquée', plural: 'Occasions manquées', color: 'var(--c-miss)' },
  blunder: { label: 'Gaffe', plural: 'Gaffes', color: 'var(--c-blunder)', symbol: '??' },
  forced: { label: 'Forcé', plural: 'Forcés', color: 'var(--c-forced)' },
};

export const CLASS_HEX: Record<Classification, string> = {
  brilliant: '#1bb9a0',
  great: '#5b8bd4',
  best: '#81b64c',
  excellent: '#96bc4b',
  good: '#97af8b',
  book: '#c69c74',
  inaccuracy: '#f2be37',
  mistake: '#f59a3d',
  miss: '#ff7769',
  blunder: '#fa412d',
  forced: '#8e9bab',
};

function Glyph({ cls }: { cls: Classification }) {
  const white = '#fff';
  switch (cls) {
    case 'best':
      return <path d="M10 3.6l1.95 3.95 4.36.63-3.16 3.08.75 4.34L10 13.55l-3.9 2.05.75-4.34L3.69 8.18l4.36-.63z" fill={white} />;
    case 'excellent':
      return (
        <path
          d="M7.2 9.1l2.3-4.6c.8 0 1.45.65 1.45 1.45v2.1h2.9c.85 0 1.45.8 1.25 1.62l-.95 3.9c-.15.6-.7 1.03-1.32 1.03H7.2zM4.6 9.1h1.6v5.5H4.6a.6.6 0 01-.6-.6V9.7c0-.33.27-.6.6-.6z"
          fill={white}
        />
      );
    case 'good':
      return <path d="M5.2 10.4l3.1 3 6.5-6.6" stroke={white} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    case 'book':
      return (
        <path
          d="M4.5 6.2c1.9-.7 3.8-.5 5.5.6 1.7-1.1 3.6-1.3 5.5-.6v8.2c-1.9-.6-3.8-.4-5.5.6-1.7-1-3.6-1.2-5.5-.6z M10 6.8v8.2"
          fill={white}
          stroke="rgba(0,0,0,.18)"
          strokeWidth=".8"
        />
      );
    case 'miss':
      return <path d="M6.6 6.6l6.8 6.8M13.4 6.6l-6.8 6.8" stroke={white} strokeWidth="2.5" strokeLinecap="round" />;
    case 'forced':
      return <path d="M5 10h8.5M10.5 6.5L14 10l-3.5 3.5" stroke={white} strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    default: {
      const sym = CLASS_META[cls].symbol ?? '';
      const size = sym.length > 1 ? 11.5 : 14;
      return (
        <text
          x="10"
          y="10.4"
          textAnchor="middle"
          dominantBaseline="central"
          fill={white}
          fontFamily="Outfit Variable, Outfit, sans-serif"
          fontWeight={900}
          fontSize={size}
          letterSpacing={sym.length > 1 ? -1 : 0}
        >
          {sym}
        </text>
      );
    }
  }
}

export function ClassIcon({ cls, size = 20, shadow = false, className }: { cls: Classification; size?: number; shadow?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} style={{ flexShrink: 0, filter: shadow ? 'drop-shadow(0 2px 3px rgba(0,0,0,.45))' : undefined }}>
      <circle cx="10" cy="10" r="10" fill={CLASS_HEX[cls]} />
      <circle cx="10" cy="10" r="9.3" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".8" />
      <Glyph cls={cls} />
    </svg>
  );
}
