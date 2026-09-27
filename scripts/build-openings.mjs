// Construit la base d'ouvertures (coups théoriques) à partir du jeu de données
// libre lichess-org/chess-openings (CC0). Produit src/data/openings.json :
//   names: [eco, nomFrançais][]
//   book:  { hashPosition: indexNom | -1 }   (-1 = position théorique sans nom propre)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Hash 53 bits (cyrb53) — doit rester identique à src/lib/openings.ts
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const posKey = (fen) => fen.split(' ').slice(0, 4).join(' ');

// --- Traduction française des noms d'ouvertures -----------------------------
const FAMILY = {
  "Sicilian Defense": 'Défense sicilienne',
  'Ruy Lopez': 'Partie espagnole',
  'French Defense': 'Défense française',
  "Queen's Gambit Declined": 'Gambit dame refusé',
  "Queen's Gambit Accepted": 'Gambit dame accepté',
  "Queen's Gambit": 'Gambit dame',
  'Italian Game': 'Partie italienne',
  'English Opening': 'Ouverture anglaise',
  "King's Gambit Accepted": 'Gambit du roi accepté',
  "King's Gambit Declined": 'Gambit du roi refusé',
  "King's Gambit": 'Gambit du roi',
  "King's Indian Defense": 'Défense est-indienne',
  "King's Indian Attack": 'Attaque est-indienne',
  'Caro-Kann Defense': 'Défense Caro-Kann',
  'Nimzo-Indian Defense': 'Défense nimzo-indienne',
  "Queen's Pawn Game": 'Partie du pion dame',
  "King's Pawn Game": 'Partie du pion roi',
  "King's Pawn Opening": 'Ouverture du pion roi',
  "King's Knight Opening": 'Ouverture du cavalier roi',
  'Semi-Slav Defense': 'Défense semi-slave',
  'Slav Defense': 'Défense slave',
  'Dutch Defense': 'Défense hollandaise',
  'Benoni Defense': 'Défense Benoni',
  'Grünfeld Defense': 'Défense Grünfeld',
  'Neo-Grünfeld Defense': 'Défense néo-Grünfeld',
  "Queen's Indian Defense": 'Défense ouest-indienne',
  'Alekhine Defense': 'Défense Alekhine',
  'Scotch Game': 'Partie écossaise',
  'Indian Defense': 'Défense indienne',
  "Petrov's Defense": 'Défense Petrov',
  'Four Knights Game': 'Partie des quatre cavaliers',
  'Three Knights Opening': 'Partie des trois cavaliers',
  'Zukertort Opening': 'Ouverture Zukertort',
  'Scandinavian Defense': 'Défense scandinave',
  'Philidor Defense': 'Défense Philidor',
  'Réti Opening': 'Ouverture Réti',
  'Nimzowitsch Defense': 'Défense Nimzowitsch',
  'Vienna Game': 'Partie viennoise',
  'Vienna Gambit': 'Gambit viennois',
  "Bishop's Opening": 'Ouverture du fou',
  'Modern Defense': 'Défense moderne',
  'Catalan Opening': 'Ouverture catalane',
  'Pirc Defense': 'Défense Pirc',
  'Bird Opening': 'Ouverture Bird',
  'Tarrasch Defense': 'Défense Tarrasch',
  'Polish Opening': 'Ouverture polonaise',
  'Bogo-Indian Defense': 'Défense bogo-indienne',
  'Old Indian Defense': 'Défense vieille-indienne',
  'Hungarian Opening': 'Ouverture hongroise',
  'Grob Opening': 'Ouverture Grob',
  'Center Game': 'Partie du centre',
  'Latvian Gambit': 'Gambit letton',
  'Latvian Gambit Accepted': 'Gambit letton accepté',
  'Ponziani Opening': 'Ouverture Ponziani',
  'Danish Gambit': 'Gambit danois',
  'Danish Gambit Accepted': 'Gambit danois accepté',
  'London System': 'Système de Londres',
  'Colle System': 'Système Colle',
  'Trompowsky Attack': 'Attaque Trompowsky',
  'Torre Attack': 'Attaque Torre',
  'English Defense': 'Défense anglaise',
  'Elephant Gambit': "Gambit de l'éléphant",
  'Portuguese Opening': 'Ouverture portugaise',
  'Mexican Defense': 'Défense mexicaine',
  'Polish Defense': 'Défense polonaise',
  'Modern Defense with 1. d4': 'Défense moderne avec 1. d4',
  'Rat Defense': 'Défense du rat',
  'Lion Defense': 'Défense du lion',
  'Kangaroo Defense': 'Défense kangourou',
  'Goldsmith Defense': 'Défense Goldsmith',
  'Scotch Gambit': 'Gambit écossais',
  'Evans Gambit': 'Gambit Evans',
  'Two Knights Defense': 'Défense des deux cavaliers',
  'Giuoco Piano': 'Giuoco Piano',
};
const WORDS = [
  [/\bVariation\b/g, 'variante'],
  [/\bDefense\b/g, 'défense'],
  [/\bDefence\b/g, 'défense'],
  [/\bAttack\b/g, 'attaque'],
  [/\bGambit Accepted\b/g, 'gambit accepté'],
  [/\bGambit Declined\b/g, 'gambit refusé'],
  [/\bCountergambit\b/g, 'contre-gambit'],
  [/\bCounterattack\b/g, 'contre-attaque'],
  [/\bSystem\b/g, 'système'],
  [/\bOpening\b/g, 'ouverture'],
  [/\bGame\b/g, 'partie'],
  [/\bMain Line\b/gi, 'ligne principale'],
  [/\bLine\b/g, 'ligne'],
  [/\bSpanish\b/g, 'espagnole'],
  [/\bItalian\b/g, 'italienne'],
  [/\bScotch\b/g, 'écossaise'],
  [/\bSymmetrical\b/g, 'symétrique'],
  [/\bReversed\b/g, 'inversée'],
  [/\bCentral\b/g, 'centrale'],
  [/\bExchange\b/g, "d'échange"],
  [/\bAdvance\b/g, 'avance'],
  [/\bAccelerated\b/g, 'accélérée'],
  [/\bClassical\b/g, 'classique'],
  [/\bModern\b/g, 'moderne'],
  [/\bOld\b/g, 'ancienne'],
  [/\bClosed\b/g, 'fermée'],
  [/\bOpen\b/g, 'ouverte'],
  [/\bDeferred\b/g, 'différée'],
  [/\bwith\b/g, 'avec'],
  [/\bDeclined\b/g, 'refusé'],
  [/\bAccepted\b/g, 'accepté'],
  [/\bRefutation\b/g, 'réfutation'],
  [/\bTrap\b/g, 'piège'],
  [/\bDragon\b/g, 'Dragon'],
  [/\bNajdorf\b/g, 'Najdorf'],
];
// "Foo variante" -> "variante Foo" : on remet le mot générique en tête.
function frenchify(part) {
  const trimmed = part.trim();
  if (FAMILY[trimmed]) return FAMILY[trimmed];
  let s = trimmed;
  for (const [re, fr] of WORDS) s = s.replace(re, fr);
  const m = s.match(/^(.*?)\s+(variante|défense|attaque|système|ouverture|partie|gambit|ligne|contre-gambit|contre-attaque)$/i);
  if (m && m[1]) s = `${m[2]} ${m[1]}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function translate(name) {
  const [family, ...rest] = name.split(':');
  let fam = family.trim();
  let famFr = FAMILY[fam];
  if (!famFr) {
    // "Vienna Gambit, with Max Lange Defense"
    const [base, ...tail] = fam.split(',');
    famFr = FAMILY[base.trim()] ?? frenchify(base);
    if (tail.length) famFr += ', ' + tail.map((t) => frenchify(t)).join(', ');
  }
  if (!rest.length) return famFr;
  const vars = rest.join(':').split(',').map((v) => frenchify(v));
  return `${famFr} : ${vars.join(', ')}`;
}

// --- Construction ------------------------------------------------------------
const names = [];
const book = {};
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const lines = readFileSync(join(root, 'scripts', 'data', `${f}.tsv`), 'utf8').trim().split('\n').slice(1);
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t');
    const chess = new Chess();
    const sans = pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/);
    let ok = true;
    for (const san of sans) {
      try {
        chess.move(san);
      } catch {
        ok = false;
        break;
      }
      const k = cyrb53(posKey(chess.fen()));
      if (!(k in book)) book[k] = -1;
    }
    if (!ok) {
      console.warn('Ligne invalide', eco, name);
      continue;
    }
    const idx = names.push([eco, translate(name)]) - 1;
    book[cyrb53(posKey(chess.fen()))] = idx;
  }
}
mkdirSync(join(root, 'src', 'data'), { recursive: true });
writeFileSync(join(root, 'src', 'data', 'openings.json'), JSON.stringify({ names, book }));
console.log(`${names.length} ouvertures, ${Object.keys(book).length} positions théoriques`);
console.log(names.filter((_, i) => i % 400 === 0).map((n) => n.join(' ')).join('\n'));
