import { useData } from '../../app/store';
import { href, navigate } from '../../app/router';
import { completedSessions, unfinishedSession } from '../../lib/history';
import { estimatedMinutes, isThreeByThreeByThree } from '../../lib/validate';
import { formatDate } from '../../lib/format';
import { Icon } from '../../components/Icon';

export function WorkoutsList() {
  const { workouts, sessions, actions } = useData();
  const done = completedSessions(sessions);
  const unfinished = unfinishedSession(sessions);
  const ordered = [...workouts].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="display display--l">Workouts</h1>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={async () => {
            const w = await actions.createWorkout();
            navigate(`/workouts/${w.id}`);
          }}
        >
          <Icon name="plus" size={18} /> New workout
        </button>
      </header>

      {ordered.length === 0 ? <p className="empty">No workouts. Create one to get started.</p> : null}

      <ul className="workout-list">
        {ordered.map((w) => {
          const last = done.find((s) => s.workoutId === w.id);
          const count = w.blocks.reduce((n, b) => n + b.slots.length, 0);
          const standard = isThreeByThreeByThree(w);
          return (
            <li key={w.id} className="workout-entry">
              <a className="workout-entry__main" href={href(`/workouts/${w.id}`)} aria-label={`View or edit ${w.name}`}>
                <span className="workout-entry__code" aria-hidden="true">{w.code}</span>
                <span className="workout-entry__text">
                  <strong className="workout-entry__name">{w.name}</strong>
                  <span>{w.focus || 'No focus written yet'}</span>
                  <span className="muted num">
                    {w.blocks.length} blocks · {count} exercises · about {estimatedMinutes(w)} min{standard ? ' · 3×3×3' : ''}
                  </span>
                  <span className="muted">{last ? `Last done ${formatDate(last.endedAt ?? last.startedAt)}` : 'Not done yet'}</span>
                </span>
              </a>
              <div className="workout-entry__actions">
                <a className="btn btn--ghost" href={href(`/workouts/${w.id}`)}>
                  <Icon name="edit" size={18} /> View / edit
                </a>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!count}
                  onClick={async () => {
                    if (unfinished) return navigate(`/session/${unfinished.id}`);
                    const s = await actions.startSession(w.id);
                    navigate(`/session/${s.id}`);
                  }}
                >
                  {unfinished?.workoutId === w.id ? 'Continue' : unfinished ? 'Session open' : 'Start'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {unfinished ? (
        <p className="muted small">
          {unfinished.workoutName} is still open. Finish or end it before starting another.
        </p>
      ) : null}
    </div>
  );
}
