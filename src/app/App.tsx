import { useEffect, useState } from 'react';
import { StoreProvider, useData, useStore } from './store';
import { href, navigate, useRoute } from './router';
import { Icon, type IconName } from '../components/Icon';
import { Mark } from '../components/Mark';
import { Home } from '../features/home/Home';
import { WorkoutsList } from '../features/workouts/WorkoutsList';
import { WorkoutEditor } from '../features/workouts/WorkoutEditor';
import { ActiveWorkout } from '../features/session/ActiveWorkout';
import { History } from '../features/history/History';
import { SessionSummary } from '../features/history/SessionSummary';
import { Library } from '../features/exercises/Library';
import { ExerciseDetail, NewExercise } from '../features/exercises/ExerciseDetail';
import { Recovery } from '../features/recovery/Recovery';
import { Settings } from '../features/settings/Settings';
import { InstallBanner } from './InstallGuide';
import { applyUpdate, subscribeSw } from '../lib/sw-register';
import { unfinishedSession } from '../lib/history';
import type { Db } from '../db/db';

const NAV: { path: string; label: string; icon: IconName; match: string }[] = [
  { path: '/', label: 'Home', icon: 'home', match: '' },
  { path: '/workouts', label: 'Workouts', icon: 'workouts', match: 'workouts' },
  { path: '/history', label: 'History', icon: 'history', match: 'history' },
  { path: '/library', label: 'Library', icon: 'library', match: 'library' },
  { path: '/recovery', label: 'Recovery', icon: 'recovery', match: 'recovery' },
];

function Screen({ route }: { route: string[] }) {
  const [a, b, c] = route;
  switch (a) {
    case undefined:
      return <Home />;
    case 'workouts':
      return b ? <WorkoutEditor key={b} id={b} /> : <WorkoutsList />;
    case 'session':
      return b ? <ActiveWorkout id={b} /> : <Home />;
    case 'history':
      return b ? <SessionSummary key={b} id={b} /> : <History />;
    case 'library':
      return b === 'new' ? <NewExercise /> : b ? <ExerciseDetail key={b} id={b} /> : <Library />;
    case 'recovery':
      return <Recovery />;
    case 'settings':
      return <Settings />;
    default:
      void c;
      return (
        <div className="page">
          <p className="empty">That page doesn't exist.</p>
          <a className="btn btn--ghost" href={href('/')}>
            Go home
          </a>
        </div>
      );
  }
}

function UpdateBanner() {
  const { sessions } = useData();
  const [ready, setReady] = useState(false);
  useEffect(() => subscribeSw((s) => setReady(s.updateReady)), []);
  if (!ready) return null;
  const training = !!unfinishedSession(sessions);
  return (
    <aside className="update" role="status">
      <span>{training ? 'A new version of REP is ready. Update after your workout — your session is saved either way.' : 'A new version of REP is ready.'}</span>
      <button type="button" className="btn btn--small btn--solid" onClick={applyUpdate}>
        Update
      </button>
    </aside>
  );
}

function OnlineState() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <p className="offline" role="status">
      Offline — logging still works and saves on this device.
    </p>
  );
}

function Shell() {
  const route = useRoute();
  const inSession = route[0] === 'session';
  const { toasts, dismissToast } = useStore();
  const top = route[0] ?? '';

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [route.join('/')]);

  return (
    <div className={`shell${inSession ? ' shell--session' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!inSession ? (
        <nav className="nav" aria-label="Main">
          <a className="nav__brand" href={href('/')} aria-label="REP home">
            <Mark size={24} title="" />
          </a>
          {NAV.map((n) => {
            const active = top === n.match || (n.match === '' && top === '');
            return (
              <a key={n.path} className="nav__item" href={href(n.path)} aria-current={active ? 'page' : undefined}>
                <Icon name={n.icon} />
                <span>{n.label}</span>
              </a>
            );
          })}
          <a className="nav__item nav__item--settings" href={href('/settings')} aria-current={top === 'settings' ? 'page' : undefined}>
            <Icon name="settings" />
            <span>Settings</span>
          </a>
        </nav>
      ) : null}
      <main id="main" className="main" tabIndex={-1}>
        <OnlineState />
        <UpdateBanner />
        {!inSession && top === '' ? <InstallBanner /> : null}
        <Screen route={route} />
      </main>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <span>{t.text}</span>
            <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Gate() {
  const { state } = useStore();
  if (state.kind === 'loading') {
    return (
      <div className="splash" aria-busy="true">
        <Mark size={56} title="REP is loading" />
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="splash splash--error" role="alert">
        <Mark size={48} title="REP" />
        <h1 className="display display--l">Storage unavailable</h1>
        <p>{state.message}</p>
        <p className="muted">
          REP saves workouts only on this device, so it won't let you train without storage — anything you logged would be lost. Leave Private
          Browsing, free up space, or open REP from your Home Screen, then reload.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
  return <Shell />;
}

export function App({ dbFactory }: { dbFactory?: () => Promise<Db> }) {
  return (
    <StoreProvider {...(dbFactory ? { dbFactory } : {})}>
      <Gate />
    </StoreProvider>
  );
}

export { navigate };
