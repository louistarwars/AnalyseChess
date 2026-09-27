import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { BarChart3, CheckCircle2, Home, Plus, Settings, SquareStack, XCircle, Info } from 'lucide-react';
import { useEffect } from 'react';
import { isNative, tapFeedback } from './lib/native';
import { loadOpenings } from './lib/openings';
import { GamesScreen } from './screens/GamesScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ImportScreen } from './screens/ImportScreen';
import { ReviewScreen } from './screens/review/ReviewScreen';
import { AboutScreen, SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { useApp, type Tab } from './store/app';
import './screens/screens.css';

function TabBar() {
  const { tab, setTab } = useApp();
  const item = (id: Tab, label: string, Icon: typeof Home) => (
    <button
      className={`tab ${tab === id ? 'active' : ''}`}
      onClick={() => {
        tapFeedback();
        setTab(id);
      }}
    >
      <Icon size={22} strokeWidth={tab === id ? 2.4 : 2} />
      {label}
    </button>
  );
  return (
    <nav className="tabbar">
      {item('home', 'Accueil', Home)}
      {item('games', 'Parties', SquareStack)}
      <button
        className="tab-fab"
        aria-label="Importer"
        onClick={() => {
          tapFeedback('medium');
          setTab('import');
        }}
      >
        <Plus size={28} strokeWidth={2.6} />
      </button>
      {item('stats', 'Stats', BarChart3)}
      {item('settings', 'Réglages', Settings)}
    </nav>
  );
}

function Toast() {
  const toast = useApp((s) => s.toast);
  if (!toast) return null;
  const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? XCircle : Info;
  const color = toast.kind === 'success' ? 'var(--accent-hi)' : toast.kind === 'error' ? '#ff8c80' : 'var(--text-2)';
  return (
    <div className="toast" key={toast.id}>
      <Icon size={19} color={color} style={{ flexShrink: 0 }} />
      {toast.text}
    </div>
  );
}

export default function App() {
  const { loaded, tab, stack, init } = useApp();

  useEffect(() => {
    init().finally(() => {
      if (isNative) void SplashScreen.hide().catch(() => undefined);
    });
    void loadOpenings();
    if (!isNative) return;
    const sub = CapApp.addListener('backButton', () => {
      if (!useApp.getState().pop()) void CapApp.exitApp();
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, [init]);

  const top = stack[stack.length - 1];

  return (
    <div className="app">
      {loaded && (
        <>
          <div key={tab} style={{ position: 'absolute', inset: 0 }}>
            {tab === 'home' && <HomeScreen />}
            {tab === 'games' && <GamesScreen />}
            {tab === 'import' && <ImportScreen />}
            {tab === 'stats' && <StatsScreen />}
            {tab === 'settings' && <SettingsScreen />}
          </div>
          {!top && <TabBar />}
          {top && (
            <div className="stack-layer stack-enter" key={stack.length + (top.name === 'review' ? top.gameId : top.name)}>
              {top.name === 'review' && <ReviewScreen gameId={top.gameId} initialPly={top.ply} />}
              {top.name === 'about' && <AboutScreen />}
            </div>
          )}
        </>
      )}
      <Toast />
    </div>
  );
}
