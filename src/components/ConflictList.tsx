import type { Conflict } from '../lib/conflicts';
import { Icon } from './Icon';

const LABEL = { blocked: 'Setup conflict', confirm: 'Check your setup', notice: 'Heads up' } as const;

export function ConflictList({ conflicts, onConfirmPair }: { conflicts: Conflict[]; onConfirmPair?: (key: string) => void }) {
  if (!conflicts.length) return null;
  return (
    <ul className="conflicts">
      {conflicts.map((c, i) => (
        <li key={`${c.rule}-${i}`} className={`conflict conflict--${c.severity}`}>
          <Icon name={c.severity === 'blocked' ? 'lock' : c.severity === 'confirm' ? 'alert' : 'info'} size={18} />
          <div>
            <strong>{LABEL[c.severity]}</strong>
            <p>{c.message}</p>
            {c.severity === 'confirm' && c.pairKey && onConfirmPair ? (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => onConfirmPair(c.pairKey!)}>
                I've checked — they fit together
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
