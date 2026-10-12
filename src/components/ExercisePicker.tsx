import { useMemo, useState } from 'react';
import type { Exercise } from '../types';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

export interface PickOption {
  exercise: Exercise;
  blockedReason?: string;
  note?: string;
}

export function ExercisePicker({
  title,
  options,
  onPick,
  onClose,
  intro,
}: {
  title: string;
  options: PickOption[];
  onPick: (e: Exercise) => void;
  onClose: () => void;
  intro?: string;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t
      ? options.filter((o) => `${o.exercise.name} ${o.exercise.movement} ${o.exercise.primaryMuscles.join(' ')}`.toLowerCase().includes(t))
      : options;
  }, [q, options]);

  return (
    <Dialog title={title} onClose={onClose} wide>
      {intro ? <p className="muted">{intro}</p> : null}
      <label className="field">
        <span className="field__label">Search</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, muscle or movement" data-autofocus />
      </label>
      <ul className="pick-list">
        {shown.map((o) => (
          <li key={o.exercise.id}>
            <button
              type="button"
              className="pick"
              disabled={!!o.blockedReason}
              aria-describedby={o.blockedReason || o.note ? `why-${o.exercise.id}` : undefined}
              onClick={() => onPick(o.exercise)}
            >
              <span className="pick__name">{o.exercise.name}</span>
              <span className="pick__meta muted">
                {o.exercise.movement} · {o.exercise.primaryMuscles.join(', ')}
                {o.exercise.availability === 'clinician-review' ? ' · needs clinician review' : ''}
              </span>
              {o.blockedReason ? (
                <span id={`why-${o.exercise.id}`} className="pick__why">
                  <Icon name="lock" size={16} /> {o.blockedReason}
                </span>
              ) : o.note ? (
                <span id={`why-${o.exercise.id}`} className="pick__note">
                  <Icon name="info" size={16} /> {o.note}
                </span>
              ) : null}
            </button>
          </li>
        ))}
        {shown.length === 0 ? <li className="muted">No exercises match “{q}”.</li> : null}
      </ul>
    </Dialog>
  );
}
