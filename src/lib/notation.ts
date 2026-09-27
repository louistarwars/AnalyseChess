const FR: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' };

/** Notation algébrique française : Cf3, Dxd5, Txe8+, e8=D… */
export function toFrenchSan(san: string): string {
  return san.replace(/[KQRBN]/g, (c) => FR[c] ?? c);
}

export type NotationStyle = 'figurine' | 'fr' | 'en';

export function formatSan(san: string, style: NotationStyle): string {
  if (style === 'fr') return toFrenchSan(san);
  return san;
}

/** Découpe un SAN en (pièce, reste) pour l'affichage en figurines. */
export function splitSan(san: string): { piece?: 'K' | 'Q' | 'R' | 'B' | 'N'; rest: string; promo?: 'Q' | 'R' | 'B' | 'N' } {
  const m = san.match(/^([KQRBN])(.*)$/);
  const promoMatch = san.match(/=([QRBN])/);
  const promo = promoMatch ? (promoMatch[1] as 'Q' | 'R' | 'B' | 'N') : undefined;
  if (m) return { piece: m[1] as 'K' | 'Q' | 'R' | 'B' | 'N', rest: m[2], promo };
  return { rest: promo ? san.replace(/=[QRBN]/, '=') : san, promo };
}
