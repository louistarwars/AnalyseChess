import { Capacitor, CapacitorHttp } from '@capacitor/core';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * GET HTTP : via la couche native sur Android (pas de restriction CORS),
 * via fetch dans le navigateur.
 */
export async function httpGet(url: string, accept = 'application/json'): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { Accept: accept };
  if (Capacitor.isNativePlatform()) {
    // L'API Chess.com demande un User-Agent identifiable.
    headers['User-Agent'] = 'AnalyseChess/1.0 (Android; +https://github.com/louistarwars/AnalyseChess)';
    const res = await CapacitorHttp.get({ url, headers, responseType: 'text', connectTimeout: 20000, readTimeout: 90000 });
    return { status: res.status, data: res.data };
  }
  const res = await fetch(url, { headers });
  const text = await res.text();
  return { status: res.status, data: text };
}

function asText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data == null) return '';
  return JSON.stringify(data);
}

export async function getJson<T>(url: string): Promise<T> {
  const { status, data } = await httpGet(url, 'application/json');
  if (status === 404) throw new HttpError(404, 'Introuvable');
  if (status === 429) throw new HttpError(429, 'Trop de requêtes, réessayez dans une minute');
  if (status < 200 || status >= 300) throw new HttpError(status, `Erreur réseau (${status})`);
  if (typeof data === 'object' && data !== null) return data as T;
  try {
    return JSON.parse(asText(data)) as T;
  } catch {
    throw new HttpError(status, 'Réponse illisible du serveur');
  }
}

export async function getText(url: string, accept: string): Promise<string> {
  const { status, data } = await httpGet(url, accept);
  if (status === 404) throw new HttpError(404, 'Introuvable');
  if (status === 429) throw new HttpError(429, 'Trop de requêtes, réessayez dans une minute');
  if (status < 200 || status >= 300) throw new HttpError(status, `Erreur réseau (${status})`);
  return asText(data);
}

export function networkErrorMessage(e: unknown): string {
  if (e instanceof HttpError) return e.message;
  const msg = (e as Error)?.message ?? '';
  if (/network|failed to fetch|timeout|unable to resolve|UnknownHost/i.test(msg)) return 'Pas de connexion internet';
  return msg || 'Erreur inconnue';
}
