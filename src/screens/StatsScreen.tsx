import { Brain, CheckCircle2, Crosshair, Flame, Lightbulb, LineChart as LineIcon, Sparkles, Swords, Target, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ClassIcon, CLASS_META } from '../components/ClassIcon';
import { TimeClassIcon } from '../components/GameCard';
import { accuracyColor, CountUp, LineChart, PlatformLogo, Radar, timeClassLabel } from '../components/ui';
import { computeInsights, type OpeningStat, type Record3 } from '../lib/insights';
import type { Classification, TimeClass } from '../lib/types';
import { useApp } from '../store/app';

function WDL({ r, total }: { r: Record3; total: number }) {
  const t = Math.max(1, total);
  return (
    <>
      <div className="wdl-bar">
        <div style={{ flex: r.win / t, background: 'var(--win)' }} />
        <div style={{ flex: r.draw / t, background: 'var(--draw)' }} />
        <div style={{ flex: r.loss / t, background: 'var(--loss)' }} />
      </div>
      <div className="wdl-legend">
        <span>
          <b style={{ color: 'var(--accent-hi)' }}>{r.win}</b> V · {Math.round((r.win / t) * 100)}%
        </span>
        <span>
          <b>{r.draw}</b> N
        </span>
        <span>
          <b style={{ color: '#ff8c80' }}>{r.loss}</b> D
        </span>
      </div>
    </>
  );
}

function OpeningList({ items }: { items: OpeningStat[] }) {
  if (!items.length) return <div className="dim small">Pas encore de parties avec cette couleur.</div>;
  return (
    <div>
      {items.map((o) => {
        const t = Math.max(1, o.games);
        return (
          <div key={o.name} className="opening-row">
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 600, fontSize: 14 }}>
                {o.name}
              </div>
              <div className="dim tiny">
                {o.games} partie{o.games > 1 ? 's' : ''} · {Math.round(o.score)}% des points
                {o.accuracy !== undefined ? ` · précision ${o.accuracy.toFixed(0)}%` : ''}
              </div>
            </div>
            <div className="mini-wdl">
              <div style={{ flex: o.record.win / t, background: 'var(--win)' }} />
              <div style={{ flex: o.record.draw / t, background: 'var(--draw)' }} />
              <div style={{ flex: o.record.loss / t, background: 'var(--loss)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StatsScreen() {
  const { games, accounts, setTab, enqueueAnalysis, showToast } = useApp();
  const [color, setColor] = useState<'w' | 'b'>('w');
  const [tc, setTc] = useState<TimeClass | 'all'>('all');
  const filtered = useMemo(() => (tc === 'all' ? games : games.filter((g) => g.timeClass === tc)), [games, tc]);
  const ins = useMemo(() => computeInsights(filtered), [filtered]);
  const timeClasses = useMemo(() => [...new Set(games.filter((g) => g.userColor).map((g) => g.timeClass))], [games]);
  const todo = games.filter((g) => g.userColor && !g.summary);

  if (!games.some((g) => g.userColor)) {
    return (
      <div className="screen page-enter">
        <div className="topbar">
          <h1 data-kana="統計">Statistiques</h1>
        </div>
        <div className="card empty">
          <div className="empty-icon">
            <LineIcon size={32} />
          </div>
          <h3>Liez votre compte</h3>
          <p className="small" style={{ margin: '0 0 16px' }}>
            Vos statistiques, votre Elo estimé, vos points forts et vos points faibles apparaîtront ici dès que vos parties seront importées.
          </p>
          <div className="col">
            <button className="btn primary" onClick={() => setTab('import', { importTab: 'chesscom' })}>
              <PlatformLogo platform="chesscom" size={22} /> Chess.com
            </button>
            <button className="btn secondary" onClick={() => setTab('import', { importTab: 'lichess' })}>
              <PlatformLogo platform="lichess" size={22} /> Lichess
            </button>
          </div>
        </div>
      </div>
    );
  }

  const perGameCls: Classification[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  const eloPoints = ins.eloSeries.map((p, i) => ({ x: i, y: p.elo }));
  const ratingPoints = ins.ratingSeries.filter((p) => p.tc === ins.mainTimeClass).map((p) => ({ x: p.t, y: p.r }));

  return (
    <div className="screen page-enter">
      <div className="topbar">
        <h1 data-kana="統計">Statistiques</h1>
        {accounts[0] && <PlatformLogo platform={accounts[0].platform} size={30} />}
      </div>

      {timeClasses.length > 1 && (
        <div className="chips" style={{ marginBottom: 14 }}>
          <button className={`chip ${tc === 'all' ? 'active' : ''}`} onClick={() => setTc('all')}>
            Toutes cadences
          </button>
          {timeClasses.map((t) => (
            <button key={t} className={`chip ${tc === t ? 'active' : ''}`} onClick={() => setTc(t)}>
              <TimeClassIcon tc={t} /> {timeClassLabel(t)}
            </button>
          ))}
        </div>
      )}

      {/* Elo estimé + prédiction */}
      <div className="hero rise" data-kanji="王手">
        <div className="hero-label">Niveau estimé par l’analyse</div>
        <div className="row" style={{ alignItems: 'flex-end', gap: 14 }}>
          <div className="hero-elo">{ins.estimatedElo ? <CountUp value={ins.estimatedElo.elo} /> : '– – –'}</div>
          {ins.estimatedElo && <div className="hero-sub" style={{ paddingBottom: 8 }}>± {ins.estimatedElo.margin} Elo</div>}
        </div>
        <div className="hero-sub">
          {ins.estimatedElo
            ? `Basé sur la précision de vos ${ins.estimatedElo.n} dernière${ins.estimatedElo.n > 1 ? 's' : ''} partie${ins.estimatedElo.n > 1 ? 's' : ''} analysée${ins.estimatedElo.n > 1 ? 's' : ''}`
            : 'Analysez vos parties pour obtenir une estimation de votre niveau réel.'}
        </div>
        {ins.currentRating && ins.estimatedElo && (
          <div className="hero-stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="hero-stat">
              <b>{ins.currentRating}</b>
              <span>Elo actuel ({timeClassLabel(ins.mainTimeClass ?? 'unknown').toLowerCase()})</span>
            </div>
            <div className="hero-stat">
              <b style={{ color: ins.estimatedElo.elo >= ins.currentRating ? '#b6f08a' : '#ffb0a6' }}>
                {ins.estimatedElo.elo >= ins.currentRating ? '+' : ''}
                {ins.estimatedElo.elo - ins.currentRating}
              </b>
              <span>{ins.estimatedElo.elo >= ins.currentRating ? 'Potentiel de progression' : 'Écart jeu analysé / Elo'}</span>
            </div>
          </div>
        )}
        {todo.length > 0 && (
          <button
            className="btn primary block"
            style={{ marginTop: 16 }}
            onClick={() => {
              const ids = todo.slice(0, 15).map((g) => g.id);
              enqueueAnalysis(ids);
              showToast(`${ids.length} parties ajoutées à l'analyse`, 'success');
            }}
          >
            <Sparkles size={18} /> Affiner avec {Math.min(15, todo.length)} parties de plus
          </button>
        )}
      </div>

      {ins.projection && ins.currentRating && (
        <div className="prediction rise">
          {ins.projection.slopePerMonth >= 0 ? <TrendingUp size={30} color="#7fb2ff" /> : <TrendingDown size={30} color="#ff9d8f" />}
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Prédiction à 30 jours : {ins.projection.projected} Elo</div>
            <div className="muted small">
              Tendance {ins.projection.slopePerMonth >= 0 ? '+' : ''}
              {ins.projection.slopePerMonth} Elo / mois en {timeClassLabel(ins.mainTimeClass ?? 'unknown').toLowerCase()}
            </div>
          </div>
        </div>
      )}

      {ratingPoints.length >= 2 && (
        <>
          <div className="section-title">
            <h2>Évolution Elo</h2>
            <span className="dim small">{timeClassLabel(ins.mainTimeClass ?? 'unknown')}</span>
          </div>
          <div className="card tight">
            <LineChart points={ratingPoints} band={40} />
          </div>
        </>
      )}

      {eloPoints.length >= 2 && (
        <>
          <div className="section-title">
            <h2>Performance par partie</h2>
          </div>
          <div className="card tight">
            <LineChart points={eloPoints} color="#26c2a3" band={100} />
          </div>
        </>
      )}

      {/* Bilan */}
      <div className="section-title">
        <h2>Bilan</h2>
        <span className="dim small">{ins.totalGames} parties</span>
      </div>
      <div className="card">
        <WDL r={ins.record} total={ins.totalGames} />
        <div className="stat-grid" style={{ marginTop: 14 }}>
          {(['w', 'b'] as const).map((c) => {
            const r = ins.byColor[c];
            const n = r.win + r.draw + r.loss;
            return (
              <div key={c} className="stat-tile" style={{ background: 'var(--bg-2)' }}>
                <div className="st-label">
                  <img src={`pieces/cburnett/${c}K.svg`} alt="" style={{ width: 18 }} /> Avec les {c === 'w' ? 'Blancs' : 'Noirs'}
                </div>
                <div className="st-value">{n ? Math.round(((r.win + r.draw / 2) / n) * 100) : 0}%</div>
                <div className="st-sub">
                  {r.win}V · {r.draw}N · {r.loss}D
                  {ins.accuracyByColor[c] !== undefined ? ` · ${ins.accuracyByColor[c]!.toFixed(0)}%` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {ins.analyzedGames > 0 && (
        <>
          <div className="section-title">
            <h2>Compétences</h2>
            <span className="dim small">{ins.analyzedGames} analysées</span>
          </div>
          {ins.skills.length >= 3 && (
            <div className="card">
              <Radar items={ins.skills.map((s) => ({ label: s.label, score: s.score }))} />
            </div>
          )}

          {ins.strengths.length > 0 && (
            <>
              <div className="section-title">
                <h2>Points forts</h2>
              </div>
              <div className="list">
                {ins.strengths.map((s) => (
                  <div key={s.title} className="insight-item good rise">
                    <div className="insight-icon">
                      <CheckCircle2 size={21} />
                    </div>
                    <div className="grow">
                      <h4>{s.title}</h4>
                      <div className="muted small">{s.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {ins.weaknesses.length > 0 && (
            <>
              <div className="section-title">
                <h2>Points faibles</h2>
              </div>
              <div className="list">
                {ins.weaknesses.map((s) => (
                  <div key={s.title} className="insight-item bad rise">
                    <div className="insight-icon">
                      <TriangleAlert size={20} />
                    </div>
                    <div className="grow">
                      <h4>{s.title}</h4>
                      <div className="muted small">{s.detail}</div>
                      {s.advice && (
                        <div className="insight-advice">
                          <Lightbulb size={15} style={{ flexShrink: 0, marginTop: 2, color: 'var(--gold)' }} />
                          {s.advice}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-title">
            <h2>Précision par phase</h2>
          </div>
          <div className="card phase-bars">
            {([
              ['opening', 'Ouverture', Brain],
              ['middlegame', 'Milieu de jeu', Swords],
              ['endgame', 'Finale', Target],
            ] as const).map(([k, label, Icon]) => {
              const v = ins.phases[k];
              return (
                <div key={k} className="phase-bar-row">
                  <div className="pb-top">
                    <span className="row" style={{ gap: 7 }}>
                      <Icon size={16} className="dim" /> {label}
                    </span>
                    <span className="num" style={{ color: v !== undefined ? accuracyColor(v) : undefined }}>
                      {v !== undefined ? `${v.toFixed(1).replace('.', ',')} %` : '–'}
                    </span>
                  </div>
                  <div className="track">
                    <div className="fill" style={{ width: `${v ?? 0}%`, background: v !== undefined ? accuracyColor(v) : undefined }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="section-title">
            <h2>Par partie, en moyenne</h2>
          </div>
          <div className="stat-grid">
            {perGameCls.map((c) => (
              <div key={c} className="stat-tile">
                <div className="st-label">
                  <ClassIcon cls={c} size={18} /> {CLASS_META[c].plural}
                </div>
                <div className="st-value" style={{ color: CLASS_META[c].color }}>
                  {(ins.perGame[c] ?? 0).toFixed(1).replace('.', ',')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">
        <h2>Répertoire</h2>
      </div>
      <div className="card">
        <div className="segmented" style={{ marginBottom: 10 }}>
          <button className={color === 'w' ? 'active' : ''} onClick={() => setColor('w')}>
            <img src="pieces/cburnett/wK.svg" alt="" style={{ width: 20 }} /> Blancs
          </button>
          <button className={color === 'b' ? 'active' : ''} onClick={() => setColor('b')}>
            <img src="pieces/cburnett/bK.svg" alt="" style={{ width: 20 }} /> Noirs
          </button>
        </div>
        <OpeningList items={ins.openings[color]} />
      </div>

      {Object.keys(ins.byTimeClass).length > 1 && (
        <>
          <div className="section-title">
            <h2>Par cadence</h2>
          </div>
          <div className="stat-grid">
            {(Object.entries(ins.byTimeClass) as [TimeClass, Record3 & { games: number }][]).map(([k, r]) => (
              <div key={k} className="stat-tile">
                <div className="st-label">
                  <TimeClassIcon tc={k} /> {timeClassLabel(k)}
                </div>
                <div className="st-value">{Math.round(((r.win + r.draw / 2) / Math.max(1, r.games)) * 100)}%</div>
                <div className="st-sub">
                  {r.games} parties · {r.win}V {r.draw}N {r.loss}D
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {ins.streak && ins.streak.count >= 2 && (
        <div className="card row" style={{ marginTop: 14 }}>
          {ins.streak.type === 'win' ? <Flame size={26} color="#ff9d4d" /> : <Crosshair size={26} color="#9aa3b4" />}
          <div className="grow">
            <b>
              {ins.streak.count} {ins.streak.type === 'win' ? 'victoires' : 'défaites'} d’affilée
            </b>
            <div className="muted small">{ins.streak.type === 'win' ? 'Continuez sur cette lancée !' : 'Une pause et une revue de vos parties peuvent aider.'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
