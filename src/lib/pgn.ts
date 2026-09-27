import { Chess, DEFAULT_POSITION, type Move } from 'chess.js';
import type { GameResult, TimeClass } from './types';

export interface ParsedMove {
  san: string;
  uci: string;
  from: string;
  to: string;
  color: 'w' | 'b';
  piece: Move['piece'];
  captured?: Move['captured'];
  promotion?: Move['promotion'];
  fenBefore: string;
  fenAfter: string;
  clock?: number;
}

export interface ParsedGame {
  headers: Record<string, string>;
  startFen: string;
  moves: ParsedMove[];
  fens: string[]; // fens[0] = position initiale, fens[i] = après le demi-coup i
  result: GameResult;
}

/** Sépare un fichier contenant plusieurs parties PGN. */
export function splitPgn(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n');
  const games: string[] = [];
  let current: string[] = [];
  let seenMoves = false;
  for (const raw of lines) {
    const line = raw.trim();
    const isHeader = /^\[\w+\s+".*"\]$/.test(line);
    if (isHeader && seenMoves) {
      games.push(current.join('\n'));
      current = [];
      seenMoves = false;
    }
    if (!isHeader && line.length > 0) seenMoves = true;
    current.push(raw);
  }
  if (current.join('').trim()) games.push(current.join('\n'));
  return games.map((g) => g.trim()).filter((g) => g.length > 0);
}

export function parseHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const re = /^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pgn))) headers[m[1]] = m[2].replace(/\\(.)/g, '$1');
  return headers;
}

interface Token {
  san: string;
  clock?: number;
}

function parseClock(comment: string): number | undefined {
  const m = comment.match(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/);
  if (!m) return undefined;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Tokenise le corps d'une partie : coups SAN (ligne principale) + pendules. */
function tokenizeMovetext(pgn: string): { tokens: Token[]; result?: GameResult } {
  const body = pgn
    .split('\n')
    .filter((l) => !/^\s*\[\w+\s+".*"\]\s*$/.test(l) && !l.trim().startsWith('%'))
    .join('\n');
  const tokens: Token[] = [];
  let result: GameResult | undefined;
  let i = 0;
  let depth = 0;
  const n = body.length;
  while (i < n) {
    const c = body[i];
    if (c === '{') {
      const end = body.indexOf('}', i + 1);
      const comment = body.slice(i + 1, end === -1 ? n : end);
      if (depth === 0 && tokens.length) {
        const clk = parseClock(comment);
        if (clk !== undefined) tokens[tokens.length - 1].clock = clk;
      }
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (c === ';') {
      const end = body.indexOf('\n', i);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (c === '(') {
      depth++;
      i++;
      continue;
    }
    if (c === ')') {
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && !/[\s{}();]/.test(body[j])) j++;
    const word = body.slice(i, j);
    i = j;
    if (depth > 0) continue;
    if (word === '1-0' || word === '0-1' || word === '1/2-1/2' || word === '*') {
      result = word;
      continue;
    }
    if (word.startsWith('$')) continue;
    // Numéros de coups ("12." / "12..." / "12...e5")
    const stripped = word.replace(/^\d+\.+/, '');
    if (!stripped) continue;
    const san = stripped
      .replace(/[!?]+/g, '')
      .replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');
    if (/^[a-hKQRBNPO]/.test(san)) tokens.push({ san });
  }
  return { tokens, result };
}

export class PgnError extends Error {}

export function parseGame(pgn: string): ParsedGame {
  const headers = parseHeaders(pgn);
  const startFen = headers.SetUp === '1' || headers.FEN ? headers.FEN || DEFAULT_POSITION : DEFAULT_POSITION;
  const chess = new Chess(startFen);
  const { tokens, result: bodyResult } = tokenizeMovetext(pgn);
  const moves: ParsedMove[] = [];
  const fens = [chess.fen()];
  for (const tok of tokens) {
    let mv: Move;
    try {
      mv = chess.move(tok.san, { strict: false });
    } catch {
      throw new PgnError(`Coup illégal ou illisible : « ${tok.san} » (coup ${Math.floor(moves.length / 2) + 1})`);
    }
    moves.push({
      san: mv.san,
      uci: mv.from + mv.to + (mv.promotion ?? ''),
      from: mv.from,
      to: mv.to,
      color: mv.color,
      piece: mv.piece,
      captured: mv.captured,
      promotion: mv.promotion,
      fenBefore: mv.before,
      fenAfter: mv.after,
      clock: tok.clock,
    });
    fens.push(mv.after);
  }
  const headerResult = headers.Result as GameResult | undefined;
  let result: GameResult = headerResult && ['1-0', '0-1', '1/2-1/2', '*'].includes(headerResult) ? headerResult : bodyResult ?? '*';
  if (result === '*' && chess.isCheckmate()) result = chess.turn() === 'w' ? '0-1' : '1-0';
  if (!moves.length && !Object.keys(headers).length) throw new PgnError('Aucune partie trouvée dans ce PGN');
  return { headers, startFen: fens[0], moves, fens, result };
}

/** Parse un PGN pouvant contenir plusieurs parties ; les parties invalides sont ignorées. */
export function parseMany(text: string): { games: { pgn: string; parsed: ParsedGame }[]; errors: string[] } {
  const games: { pgn: string; parsed: ParsedGame }[] = [];
  const errors: string[] = [];
  for (const chunk of splitPgn(text)) {
    try {
      const parsed = parseGame(chunk);
      if (parsed.moves.length === 0) {
        errors.push('Partie sans coups ignorée');
        continue;
      }
      games.push({ pgn: chunk, parsed });
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { games, errors };
}

export function timeClassFromControl(tc?: string): TimeClass {
  if (!tc || tc === '-' || tc === '?') return 'unknown';
  if (tc.includes('/')) return 'daily';
  const [base, inc] = tc.split('+').map(Number);
  if (!Number.isFinite(base)) return 'unknown';
  const total = base + 40 * (inc || 0);
  if (total < 180) return 'bullet';
  if (total < 480) return 'blitz';
  if (total < 1500) return 'rapid';
  return 'classical';
}

export function initialClock(tc?: string): { base: number; inc: number } | undefined {
  if (!tc || tc.includes('/') || tc === '-') return undefined;
  const [base, inc] = tc.split('+').map(Number);
  if (!Number.isFinite(base)) return undefined;
  return { base, inc: inc || 0 };
}

export function gameTimestamp(h: Record<string, string>): number {
  const date = (h.UTCDate || h.Date || '').replace(/\?/g, '01');
  const time = h.UTCTime || h.StartTime || '12:00:00';
  const m = date.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!m) return 0;
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${/^\d{2}:\d{2}(:\d{2})?$/.test(time) ? time : '12:00:00'}Z`);
  return Number.isFinite(t) ? t : 0;
}

/** Hash court et stable (cyrb53) — utilisé pour les identifiants de parties et le livre d'ouvertures. */
export function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function pgnGameId(parsed: ParsedGame): string {
  const h = parsed.headers;
  const key = [h.White, h.Black, h.Date, h.Round, parsed.moves.map((m) => m.uci).join('')].join('|');
  return 'pgn:' + cyrb53(key);
}
