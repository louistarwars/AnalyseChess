import { Download, Search, Sparkles, SquareStack, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GameCard } from '../components/GameCard';
import { resultForColor } from '../lib/importer';
import type { StoredGame } from '../lib/types';
import { useApp } from '../store/app';

type Filter = 'all' | 'win' | 'loss' | 'draw' | 'analyzed' | 'todo' | 'fav' | 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'win', label: 'Victoires' },
  { id: 'loss', label: 'Défaites' },
  { id: 'draw', label: 'Nulles' },
  { id: 'analyzed', label: 'Analysées' },
  { id: 'todo', label: 'À analyser' },
  { id: 'fav', label: '★ Favoris' },
  { id: 'bullet', label: 'Bullet' },
  { id: 'blitz', label: 'Blitz' },
  { id: 'rapid', label: 'Rapide' },
  { id: 'classical', label: 'Classique' },
  { id: 'daily', label: 'Par jour' },
];

function match(g: StoredGame, f: Filter): boolean {
  const res = g.userColor ? resultForColor(g.result, g.userColor) : null;
  switch (f) {
    case 'all':
      return true;
    case 'win':
    case 'loss':
    case 'draw':
      return res === f;
    case 'analyzed':
      return !!g.summary;
    case 'todo':
      return !g.summary;
    case 'fav':
      return !!g.favorite;
    default:
      return g.timeClass === f;
  }
}

export function GamesScreen() {
  const { games, setTab, enqueueAnalysis, showToast, current, queue, cancelAnalysis } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(40);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return games.filter((g) => match(g, filter) && (!s || `${g.white} ${g.black} ${g.opening ?? ''} ${g.eco ?? ''}`.toLowerCase().includes(s)));
  }, [games, filter, q]);

  const todo = list.filter((g) => !g.summary);
  const busy = !!current || queue.length > 0;

  return (
    <div className="screen page-enter">
      <div className="topbar">
        <h1>Parties</h1>
        <button className="icon-btn" onClick={() => setTab('import')} aria-label="Importer">
          <Download size={19} />
        </button>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <Search size={18} className="dim" />
        <input placeholder="Joueur, ouverture, code ECO…" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && (
          <button onClick={() => setQ('')} aria-label="Effacer">
            <X size={18} className="dim" />
          </button>
        )}
      </div>

      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="row" style={{ margin: '14px 2px 12px' }}>
        <span className="muted small grow">
          {list.length} partie{list.length > 1 ? 's' : ''}
        </span>
        {busy ? (
          <button className="btn ghost sm" onClick={() => cancelAnalysis()}>
            <X size={15} /> Arrêter les analyses
          </button>
        ) : (
          todo.length > 0 && (
            <button
              className="btn secondary sm"
              onClick={() => {
                const ids = todo.slice(0, 20).map((g) => g.id);
                enqueueAnalysis(ids);
                showToast(`${ids.length} partie${ids.length > 1 ? 's' : ''} en file d'analyse`, 'success');
              }}
            >
              <Sparkles size={15} /> Analyser {Math.min(20, todo.length)}
            </button>
          )
        )}
      </div>

      {list.length ? (
        <div className="list">
          {list.slice(0, limit).map((g, i) => (
            <GameCard key={g.id} game={g} index={i} />
          ))}
          {list.length > limit && (
            <button className="btn secondary block" onClick={() => setLimit(limit + 40)}>
              Afficher plus
            </button>
          )}
        </div>
      ) : (
        <div className="card empty">
          <div className="empty-icon">
            <SquareStack size={32} />
          </div>
          <h3>{games.length ? 'Aucun résultat' : 'Aucune partie'}</h3>
          <p className="small" style={{ margin: '0 0 16px' }}>
            {games.length ? 'Essayez un autre filtre.' : 'Importez vos parties depuis Chess.com, Lichess ou un fichier PGN.'}
          </p>
          {!games.length && (
            <button className="btn primary" onClick={() => setTab('import')}>
              <Download size={18} /> Importer des parties
            </button>
          )}
        </div>
      )}
    </div>
  );
}
