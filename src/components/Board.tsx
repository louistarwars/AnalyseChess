import { Chess, type Square } from 'chess.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsManga } from '../lib/theme';
import { BOARD_THEMES, pieceUrl } from '../lib/themes';
import type { Classification } from '../lib/types';
import { useSettings } from '../store/settings';
import { ClassIcon } from './ClassIcon';
import './board.css';

export interface Arrow {
  from: string;
  to: string;
  color?: string;
  opacity?: number;
  width?: number;
}

interface Props {
  fen: string;
  orientation?: 'w' | 'b';
  lastMove?: { from: string; to: string };
  arrows?: Arrow[];
  badge?: { square: string; cls: Classification; key?: string | number };
  interactive?: boolean;
  onMove?: (m: { from: string; to: string; promotion?: string }) => void;
  className?: string;
}

interface PieceItem {
  id: number;
  type: string;
  color: 'w' | 'b';
  square: string;
}

const FILES = 'abcdefgh';

function parsePlacement(fen: string): { type: string; color: 'w' | 'b'; square: string }[] {
  const out: { type: string; color: 'w' | 'b'; square: string }[] = [];
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        out.push({ type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'w' : 'b', square: FILES[f] + (8 - r) });
        f++;
      }
    }
  });
  return out;
}

const sqXY = (sq: string, orientation: 'w' | 'b') => {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]) - 1;
  return orientation === 'w' ? { x: f, y: 7 - r } : { x: 7 - f, y: r };
};

const dist = (a: string, b: string) => Math.abs(FILES.indexOf(a[0]) - FILES.indexOf(b[0])) + Math.abs(Number(a[1]) - Number(b[1]));

/** Conserve l'identité des pièces entre deux positions pour animer leurs déplacements. */
function usePieces(fen: string): PieceItem[] {
  const prev = useRef<{ fen: string; items: PieceItem[]; nextId: number }>({ fen: '', items: [], nextId: 1 });
  return useMemo(() => {
    const state = prev.current;
    if (state.fen === fen) return state.items;
    const target = parsePlacement(fen);
    const old = [...state.items];
    const result: (PieceItem | null)[] = target.map(() => null);
    // 1) pièces restées sur place
    target.forEach((t, i) => {
      const j = old.findIndex((o) => o.square === t.square && o.type === t.type && o.color === t.color);
      if (j >= 0) {
        result[i] = old[j];
        old.splice(j, 1);
      }
    });
    // 2) pièces déplacées : on associe la plus proche du même type
    target.forEach((t, i) => {
      if (result[i]) return;
      let best = -1;
      let bestD = 99;
      old.forEach((o, j) => {
        if (o.type === t.type && o.color === t.color) {
          const d = dist(o.square, t.square);
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        }
      });
      if (best >= 0) {
        result[i] = { ...old[best], square: t.square };
        old.splice(best, 1);
      } else {
        result[i] = { id: state.nextId++, ...t };
      }
    });
    const items = result as PieceItem[];
    prev.current = { fen, items, nextId: state.nextId };
    return items;
  }, [fen]);
}

function ArrowShape({ a, orientation, manga }: { a: Arrow; orientation: 'w' | 'b'; manga?: boolean }) {
  const s = sqXY(a.from, orientation);
  const e = sqXY(a.to, orientation);
  const cx = (p: { x: number; y: number }) => p.x * 12.5 + 6.25;
  const cy = (p: { x: number; y: number }) => p.y * 12.5 + 6.25;
  const x1 = cx(s);
  const y1 = cy(s);
  const x2 = cx(e);
  const y2 = cy(e);
  const dx = Math.abs(e.x - s.x);
  const dy = Math.abs(e.y - s.y);
  const knight = (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
  const w = a.width ?? 2.4;
  const head = w * 2.1;
  const color = a.color ?? 'rgba(129, 182, 76, 0.85)';
  const shorten = (xa: number, ya: number, xb: number, yb: number, by: number) => {
    const len = Math.hypot(xb - xa, yb - ya);
    return { x: xb - ((xb - xa) / len) * by, y: yb - ((yb - ya) / len) * by };
  };
  const startOffset = (xa: number, ya: number, xb: number, yb: number, by: number) => {
    const len = Math.hypot(xb - xa, yb - ya);
    return { x: xa + ((xb - xa) / len) * by, y: ya + ((yb - ya) / len) * by };
  };
  let pts: { x: number; y: number }[];
  if (knight) {
    const corner = dx === 2 ? { x: x2, y: y1 } : { x: x1, y: y2 };
    pts = [startOffset(x1, y1, corner.x, corner.y, 3.2), corner, shorten(corner.x, corner.y, x2, y2, head * 0.95)];
  } else {
    pts = [startOffset(x1, y1, x2, y2, 3.2), shorten(x1, y1, x2, y2, head * 0.95)];
  }
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const ang = Math.atan2(y2 - prev.y, x2 - prev.x);
  const tip = { x: last.x + Math.cos(ang) * head, y: last.y + Math.sin(ang) * head };
  const left = { x: last.x + Math.cos(ang + Math.PI / 2) * head * 0.85, y: last.y + Math.sin(ang + Math.PI / 2) * head * 0.85 };
  const right = { x: last.x + Math.cos(ang - Math.PI / 2) * head * 0.85, y: last.y + Math.sin(ang - Math.PI / 2) * head * 0.85 };
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const headPts = `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`;
  if (manga) {
    // Flèche « encre » : contour noir épais, remplissage plein, ombre décalée
    const fill = a.color?.includes('120,160,220') ? '#3c7ddb' : a.color?.includes('129,182,76') || !a.color ? '#e8322b' : a.color;
    return (
      <g opacity={a.opacity ?? 1}>
        <g transform="translate(0.7 0.8)" opacity="0.9">
          <polyline points={line} fill="none" stroke="#141414" strokeWidth={w + 1.3} strokeLinejoin="round" />
          <polygon points={headPts} fill="#141414" stroke="#141414" strokeWidth="1.3" strokeLinejoin="round" />
        </g>
        <polyline points={line} fill="none" stroke="#141414" strokeWidth={w + 1.3} strokeLinejoin="round" />
        <polygon points={headPts} fill="#141414" stroke="#141414" strokeWidth="1.3" strokeLinejoin="round" />
        <polyline points={line} fill="none" stroke={fill} strokeWidth={w - 0.1} strokeLinejoin="round" />
        <polygon points={headPts} fill={fill} />
      </g>
    );
  }
  return (
    <g opacity={a.opacity ?? 1}>
      <polyline points={line} fill="none" stroke={color} strokeWidth={w} strokeLinejoin="round" strokeLinecap="butt" />
      <polygon points={headPts} fill={color} />
    </g>
  );
}

/** Cases sombres en trame de points (thème Manga). */
function ToneSquares() {
  const rects = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 1) rects.push(<rect key={`${x}${y}`} x={x} y={y} width="1" height="1" />);
  return (
    <svg className="squares-tone" viewBox="0 0 8 8" preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id="boardTone" width="0.125" height="0.125" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx="0.0625" cy="0.0625" r="0.036" fill="#141414" />
        </pattern>
      </defs>
      <g fill="#cfc7b3">{rects}</g>
      <g fill="url(#boardTone)" opacity="0.55">
        {rects}
      </g>
      <path d="M0 0H8V8H0Z" fill="none" stroke="#141414" strokeWidth="0.03" />
    </svg>
  );
}

export function Board({ fen, orientation = 'w', lastMove, arrows = [], badge, interactive = false, onMove, className }: Props) {
  const { boardTheme, pieceSet, showCoords } = useSettings();
  const manga = useIsManga();
  const theme = BOARD_THEMES.find((t) => t.id === boardTheme) ?? BOARD_THEMES[0];
  const pieces = usePieces(fen);
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: number; from: string; x: number; y: number } | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null);
  const dragStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    setSelected(null);
    setPromo(null);
  }, [fen]);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);

  const turn = fen.split(' ')[1] as 'w' | 'b';
  const legalFrom = useMemo(() => {
    const map = new Map<string, { to: string; capture: boolean; promotion: boolean }[]>();
    if (!interactive || !chess) return map;
    for (const m of chess.moves({ verbose: true })) {
      const arr = map.get(m.from) ?? [];
      if (!arr.some((x) => x.to === m.to)) arr.push({ to: m.to, capture: !!m.captured, promotion: !!m.promotion });
      map.set(m.from, arr);
    }
    return map;
  }, [chess, interactive]);

  const checkSquare = useMemo(() => {
    if (!chess || !chess.inCheck()) return null;
    return pieces.find((p) => p.type === 'k' && p.color === turn)?.square ?? null;
  }, [chess, pieces, turn]);

  const squareAt = useCallback(
    (clientX: number, clientY: number): string | null => {
      const el = ref.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x = Math.floor(((clientX - r.left) / r.width) * 8);
      const y = Math.floor(((clientY - r.top) / r.height) * 8);
      if (x < 0 || x > 7 || y < 0 || y > 7) return null;
      return orientation === 'w' ? FILES[x] + (8 - y) : FILES[7 - x] + (y + 1);
    },
    [orientation],
  );

  const tryMove = (from: string, to: string) => {
    const opts = legalFrom.get(from)?.find((m) => m.to === to);
    if (!opts) return false;
    if (opts.promotion) {
      setPromo({ from, to, color: turn });
      return true;
    }
    onMove?.({ from, to });
    setSelected(null);
    return true;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || promo) return;
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (selected && selected !== sq && tryMove(selected, sq)) return;
    const piece = pieces.find((p) => p.square === sq);
    if (piece && piece.color === turn && legalFrom.has(sq)) {
      setSelected(sq);
      const r = ref.current!.getBoundingClientRect();
      dragStart.current = { x: e.clientX, y: e.clientY, moved: false };
      setDrag({ id: piece.id, from: sq, x: e.clientX - r.left, y: e.clientY - r.top });
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else {
      setSelected(null);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !dragStart.current) return;
    const r = ref.current!.getBoundingClientRect();
    if (Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y) > 6) dragStart.current.moved = true;
    setDrag({ ...drag, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const sq = squareAt(e.clientX, e.clientY);
    const moved = dragStart.current?.moved;
    setDrag(null);
    dragStart.current = null;
    if (moved && sq && sq !== drag.from) tryMove(drag.from, sq);
  };

  const hl = (sq: string, color: string, key: string) => {
    const { x, y } = sqXY(sq, orientation);
    return <div key={key} className="hl" style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%`, background: color }} />;
  };

  const isLight = (sq: string) => (FILES.indexOf(sq[0]) + Number(sq[1])) % 2 === 1;
  const targets = selected ? legalFrom.get(selected) ?? [] : [];

  return (
    <div
      ref={ref}
      className={`board ${className ?? ''}`}
      style={{ ['--light' as string]: theme.light, ['--dark' as string]: theme.dark }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      <div className="squares">{manga && <ToneSquares />}</div>
      {showCoords && (
        <div className="coords">
          {Array.from({ length: 8 }, (_, i) => {
            const rank = orientation === 'w' ? 8 - i : i + 1;
            const file = orientation === 'w' ? FILES[i] : FILES[7 - i];
            return (
              <span key={i}>
                <span className="rank" style={{ top: `${i * 12.5}%`, color: i % 2 === 0 ? theme.dark : theme.light }}>
                  {rank}
                </span>
                <span className="file" style={{ left: `${i * 12.5}%`, color: i % 2 === 0 ? theme.light : theme.dark }}>
                  {file}
                </span>
              </span>
            );
          })}
        </div>
      )}
      {lastMove && [lastMove.from, lastMove.to].map((sq, i) => hl(sq, isLight(sq) ? theme.hlLight : theme.hlDark, 'lm' + i))}
      {selected && hl(selected, 'rgba(20, 85, 30, 0.5)', 'sel')}
      {checkSquare && (() => {
        const { x, y } = sqXY(checkSquare, orientation);
        return <div className="check-glow" style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%` }} />;
      })()}
      <div className="pieces">
        {pieces.map((p) => {
          const { x, y } = sqXY(p.square, orientation);
          const dragging = drag?.id === p.id && dragStart.current?.moved;
          const style: React.CSSProperties = dragging
            ? { transform: `translate(${drag!.x}px, ${drag!.y}px) translate(-50%, -50%) scale(1.15)`, left: 0, top: 0, transition: 'none', zIndex: 10 }
            : { transform: `translate(${x * 100}%, ${y * 100}%)` };
          return <img key={p.id} className={`piece ${dragging ? 'dragging' : ''}`} src={pieceUrl(pieceSet, p.color, p.type)} style={style} alt="" draggable={false} />;
        })}
      </div>
      {targets.map((t) => {
        const { x, y } = sqXY(t.to, orientation);
        return <div key={t.to} className={`dot ${t.capture ? 'capture' : ''}`} style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%` }} />;
      })}
      {arrows.length > 0 && (
        <svg className="arrows" viewBox="0 0 100 100">
          {arrows.map((a, i) => (
            <ArrowShape key={`${a.from}${a.to}${i}`} a={a} orientation={orientation} manga={manga} />
          ))}
        </svg>
      )}
      {badge &&
        (() => {
          const { x, y } = sqXY(badge.square, orientation);
          return (
            <div key={`${badge.key ?? ''}${badge.square}${badge.cls}`} className="badge" style={{ left: `${(x + 1) * 12.5}%`, top: `${y * 12.5}%` }}>
              <ClassIcon cls={badge.cls} size={100} shadow />
            </div>
          );
        })()}
      {promo && (
        <div className="promo" onPointerDown={(e) => e.stopPropagation()}>
          {(['q', 'n', 'r', 'b'] as const).map((p) => (
            <button
              key={p}
              onClick={() => {
                onMove?.({ from: promo.from, to: promo.to, promotion: p });
                setPromo(null);
                setSelected(null);
              }}
            >
              <img src={pieceUrl(pieceSet, promo.color, p)} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type { Square };
