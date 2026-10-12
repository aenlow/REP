import { useData } from './store';
import { Icon } from '../components/Icon';

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
}

export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function InstallSteps() {
  return (
    <>
      <ol className="steps">
        <li>Open this page in Safari on your iPhone.</li>
        <li>
          Tap <strong>Share</strong> <Icon name="share" size={16} title="Share icon" />.
        </li>
        <li>
          Choose <strong>Add to Home Screen</strong> (scroll the list if you don't see it).
        </li>
        <li>Check the name reads REP and the icon shows the grid mark.</li>
        <li>
          Tap <strong>Add</strong>.
        </li>
        <li>Open REP from your Home Screen. It runs full screen and works offline after the first load.</li>
      </ol>
      <p className="muted small">
        The exact menu wording and some web-app features vary between iOS versions. Data saved in Safari and in the Home Screen app may be
        kept separately — install first, then start logging, or move data with a backup.
      </p>
    </>
  );
}

/** First-run hint on iPhone Safari when REP is not yet installed. */
export function InstallBanner() {
  const { settings, actions } = useData();
  if (settings.installHintDismissed || isStandalone() || !isIos()) return null;
  return (
    <aside className="install" aria-label="Install REP">
      <div>
        <strong>Add REP to your Home Screen</strong>
        <p className="muted small">
          Tap Share <Icon name="share" size={14} title="Share icon" />, then Add to Home Screen. Full screen and offline.
        </p>
      </div>
      <button type="button" className="icon-btn" aria-label="Dismiss install hint" onClick={() => actions.updateSettings({ installHintDismissed: true })}>
        <Icon name="close" />
      </button>
    </aside>
  );
}
