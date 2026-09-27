import { ArrowRight, BarChart3, ClipboardPaste, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { GameCard } from '../components/GameCard';
import { Avatar, CountUp, PlatformLogo, Ring, accuracyColor } from '../components/ui';
import { FAMOUS_GAMES } from '../data/famousGames';
import { importPgnText } from '../lib/importer';
import { computeInsights } from '../lib/insights';
import type { LinkedAccount } from '../lib/types';
import { useApp } from '../store/app';

const FAMOUS_BG = [
  'linear-gradient(140deg, #2a4d7a, #13243d)',
  'linear-gradient(140deg, #7a3a2a, #3a1812)',
  'linear-gradient(140deg, #2a6a58, #102a24)',
  'linear-gradient(140deg, #5a3a7a, #24123d)',
];
const FAMOUS_PIECE = ['wK', 'wQ', 'bN', 'wB'];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Bonne nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export function AccountCard({ acc, single }: { acc: LinkedAccount; single?: boolean }) {
  const syncing = useApp((s) => s.syncing[acc.key]);
  const sync = useApp((s) => s.sync);
  const r = acc.ratings;
  const chips: [string, number | undefined][] = [
    ['Rapide', r.rapid],
    ['Blitz', r.blitz],
    ['Bullet', r.bullet],
    ['Classique', r.classical],
    ['Par jour', r.daily],
  ];
  return (
    <div className={`card account-card ${single ? 'single' : ''}`}>
      <div className="row">
        <div style={{ position: 'relative' }}>
          <Avatar name={acc.username} src={acc.avatar} size={46} />
          <span style={{ position: 'absolute', right: -5, bottom: -5 }}>
            <PlatformLogo platform={acc.platform} size={20} />
          </span>
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="ellipsis" style={{ fontWeight: 700, fontSize: 16 }}>
            {acc.title && <span className="title-badge">{acc.title}</span>}
            {acc.username}
          </div>
          <div className="dim small ellipsis">{syncing ?? (acc.platform === 'chesscom' ? 'Chess.com' : 'Lichess')}</div>
        </div>
        <button className="icon-btn" onClick={() => sync(acc)} aria-label="Synchroniser" disabled={!!syncing}>
          <RefreshCw size={17} className={syncing ? 'spin' : ''} style={syncing ? { animation: 'spin 1s linear infinite' } : undefined} />
        </button>
      </div>
      <div className="rating-chips">
        {chips
          .filter(([, v]) => v)
          .slice(0, 3)
          .map(([label, v]) => (
            <span key={label} className="rating-chip">
              {label} <b>{v}</b>
            </span>
          ))}
      </div>
    </div>
  );
}

export function HomeScreen() {
  const { games, accounts, setTab, push, queue, current, enqueueAnalysis, showToast, reloadGames } = useApp();
  const insights = useMemo(() => computeInsights(games), [games]);
  const recent = games.slice(0, 5);
  const mainAccount = accounts[0];
  const name = mainAccount?.displayName?.split(' ')[0] || mainAccount?.username;
  const unanalyzedMine = games.filter((g) => g.userColor && !g.summary).slice(0, 10);

  const openFamous = async (i: number) => {
    const { games: imported } = await importPgnText(FAMOUS_GAMES[i].pgn, []);
    await reloadGames();
    if (imported[0]) push({ name: 'review', gameId: imported[0].id });
  };

  const progress = current?.progress;
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const totalPending = queue.length + (current ? 1 : 0);

  return (
    <div className="screen page-enter">
      <div className="topbar">
        <div className="brand">
          <div className="brand-logo">
            <img src="pieces/cburnett/wN.svg" alt="" />
          </div>
          <div className="brand-name">
            Analyse<span>Chess</span>
          </div>
        </div>
        <button className="icon-btn" onClick={() => setTab('import', { importTab: 'pgn' })} aria-label="Coller un PGN">
          <ClipboardPaste size={19} />
        </button>
      </div>

      <div className="greeting rise">
        <h2>
          {greeting()}
          {name ? `, ${name}` : ''} 👋
        </h2>
        <p>{accounts.length ? 'Prêt à progresser aujourd’hui ?' : 'Analysez vos parties comme sur chess.com, gratuitement.'}</p>
      </div>

      {accounts.length === 0 ? (
        <div className="hero onboard-hero rise" style={{ animationDelay: '60ms' }}>
          <h2>Découvrez vos coups brillants… et vos gaffes</h2>
          <p>Liez votre compte pour importer vos parties automatiquement, ou collez un PGN.</p>
          <div className="col">
            <button className="platform-btn" onClick={() => setTab('import', { importTab: 'chesscom' })}>
              <PlatformLogo platform="chesscom" size={30} /> Lier mon compte Chess.com <ArrowRight size={18} style={{ marginLeft: 'auto' }} />
            </button>
            <button className="platform-btn" onClick={() => setTab('import', { importTab: 'lichess' })}>
              <PlatformLogo platform="lichess" size={30} /> Lier mon compte Lichess <ArrowRight size={18} style={{ marginLeft: 'auto' }} />
            </button>
            <button className="platform-btn" onClick={() => setTab('import', { importTab: 'pgn' })}>
              <PlatformLogo platform="pgn" size={30} /> Importer un fichier PGN <ArrowRight size={18} style={{ marginLeft: 'auto' }} />
            </button>
          </div>
        </div>
      ) : (
        <div className="hero rise" style={{ animationDelay: '60ms' }}>
          <div className="hero-level">
            <div className="grow">
              <div className="hero-label">Elo estimé</div>
              {insights.estimatedElo ? (
                <>
                  <div className="hero-elo">
                    <CountUp value={insights.estimatedElo.elo} />
                  </div>
                  <div className="hero-sub">
                    ± {insights.estimatedElo.margin} · sur {insights.estimatedElo.n} partie{insights.estimatedElo.n > 1 ? 's' : ''} analysée{insights.estimatedElo.n > 1 ? 's' : ''}
                  </div>
                </>
              ) : (
                <>
                  <div className="hero-elo">– – –</div>
                  <div className="hero-sub">Analysez quelques parties pour estimer votre niveau réel</div>
                </>
              )}
            </div>
            {insights.accuracy !== undefined && (
              <Ring value={insights.accuracy} size={86} stroke={8} color={accuracyColor(insights.accuracy)}>
                <div style={{ textAlign: 'center', lineHeight: 1.05 }}>
                  <div className="num" style={{ fontSize: 20, fontWeight: 800 }}>
                    <CountUp value={insights.accuracy} decimals={1} />
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 700 }}>PRÉCISION</div>
                </div>
              </Ring>
            )}
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <b>{insights.totalGames}</b>
              <span>parties</span>
            </div>
            <div className="hero-stat">
              <b>{insights.totalGames ? Math.round((insights.record.win / insights.totalGames) * 100) : 0}%</b>
              <span>victoires</span>
            </div>
            <div className="hero-stat">
              {insights.projection ? (
                <>
                  <b className="row" style={{ gap: 4 }}>
                    {insights.projection.slopePerMonth >= 0 ? <TrendingUp size={17} color="#9bd35f" /> : <TrendingDown size={17} color="#ff8c80" />}
                    {insights.projection.slopePerMonth >= 0 ? '+' : ''}
                    {insights.projection.slopePerMonth}
                  </b>
                  <span>Elo / mois</span>
                </>
              ) : (
                <>
                  <b>{insights.streak ? `${insights.streak.count}${insights.streak.type === 'win' ? 'V' : 'D'}` : '–'}</b>
                  <span>série</span>
                </>
              )}
            </div>
          </div>
          {unanalyzedMine.length > 0 && !current && (
            <button
              className="btn primary block"
              style={{ marginTop: 16 }}
              onClick={() => {
                enqueueAnalysis(unanalyzedMine.map((g) => g.id));
                showToast(`${unanalyzedMine.length} parties ajoutées à l'analyse`, 'success');
              }}
            >
              <Sparkles size={18} /> Analyser mes {unanalyzedMine.length} dernières parties
            </button>
          )}
        </div>
      )}

      {totalPending > 0 && (
        <div className="queue-banner rise" style={{ marginTop: 14 }}>
          <div className="spinner" />
          <div className="grow">
            <div style={{ fontWeight: 650, fontSize: 14 }}>
              Analyse en cours · {totalPending} partie{totalPending > 1 ? 's' : ''}
            </div>
            <div className="progress" style={{ marginTop: 6, height: 6 }}>
              <div style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className="num" style={{ fontWeight: 800 }}>
            {pct}%
          </span>
        </div>
      )}

      {accounts.length > 0 && (
        <>
          <div className="section-title">
            <h2>Mes comptes</h2>
            <button className="link" onClick={() => setTab('import')}>
              Gérer
            </button>
          </div>
          <div className="accounts-row">
            {accounts.map((a) => (
              <AccountCard key={a.key} acc={a} single={accounts.length === 1} />
            ))}
          </div>
        </>
      )}

      <div className="section-title">
        <h2>Dernières parties</h2>
        {games.length > 0 && (
          <button className="link" onClick={() => setTab('games')}>
            Tout voir
          </button>
        )}
      </div>
      {recent.length ? (
        <div className="list">
          {recent.map((g, i) => (
            <GameCard key={g.id} game={g} index={i} />
          ))}
        </div>
      ) : (
        <div className="card empty">
          <div className="empty-icon">
            <BarChart3 size={32} />
          </div>
          <h3>Aucune partie pour l’instant</h3>
          <p className="small" style={{ margin: 0 }}>
            Importez vos parties ou essayez avec une partie célèbre ci-dessous.
          </p>
        </div>
      )}

      <div className="section-title">
        <h2>Parties légendaires</h2>
      </div>
      <div className="famous-row">
        {FAMOUS_GAMES.map((f, i) => (
          <button key={f.id} className="famous-card" style={{ background: FAMOUS_BG[i % FAMOUS_BG.length] }} onClick={() => openFamous(i)}>
            <img src={`pieces/cburnett/${FAMOUS_PIECE[i % FAMOUS_PIECE.length]}.svg`} alt="" />
            <b>{f.title}</b>
            <span>{f.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
