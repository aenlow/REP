import { useState } from 'react';
import { useData } from '../../app/store';
import { href, navigate } from '../../app/router';
import { Wordmark } from '../../components/Mark';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/Dialog';
import {
  activityByDay,
  completedSessions,
  formatDuration,
  localDateKey,
  nextRecommended,
  unfinishedSession,
  weekDays,
} from '../../lib/history';
import { abandon, durationMs, progress } from '../../lib/session';
import { estimatedMinutes } from '../../lib/validate';
import { formatDate, relativeDay } from '../../lib/format';

export function Home() {
  const { workouts, sessions, recoveryRoutines, actions } = useData();
  const [replacing, setReplacing] = useState<string | null>(null);
  const unfinished = unfinishedSession(sessions);
  const next = nextRecommended(workouts, sessions);
  const last = completedSessions(sessions)[0];
  const ordered = [...workouts].sort((a, b) => a.code.localeCompare(b.code));
  const days = weekDays();
  const activity = activityByDay(sessions);
  const today = localDateKey(new Date());
  const thisWeek = days.reduce((n, d) => n + (activity.get(d)?.length ?? 0), 0);

  const start = async (workoutId: string) => {
    if (unfinished) return setReplacing(workoutId);
    const s = await actions.startSession(workoutId);
    navigate(`/session/${s.id}`);
  };

  return (
    <div className="page page--home">
      <header className="topbar">
        <Wordmark />
        <a className="icon-btn" href={href('/settings')} aria-label="Settings">
          <Icon name="settings" />
        </a>
      </header>

      {unfinished ? (
        <section className="resume" aria-labelledby="resume-h">
          <p className="kicker">Unfinished session</p>
          <h1 id="resume-h" className="display display--xl">{unfinished.workoutName}</h1>
          <p className="muted">
            {progress(unfinished).done + progress(unfinished).skipped} of {progress(unfinished).total} logged · started{' '}
            {relativeDay(unfinished.startedAt)}
            {unfinished.status === 'paused' ? ' · paused' : ''}
          </p>
          <a className="btn btn--primary btn--block btn--tall" href={href(`/session/${unfinished.id}`)}>
            Continue workout
          </a>
        </section>
      ) : next ? (
        <section className="hero" aria-labelledby="next-h">
          <p className="kicker">Next in rotation</p>
          <h1 id="next-h" className="display display--hero">
            <span className="hero__code">{next.code}</span>
            <span className="hero__name">{next.focus || next.name}</span>
          </h1>
          <p className="muted num">
            {next.blocks.length} blocks · {next.blocks.reduce((n, b) => n + b.slots.length, 0)} exercises · about {estimatedMinutes(next)} min
          </p>
          <button type="button" className="btn btn--primary btn--block btn--tall" onClick={() => start(next.id)}>
            Start {next.name}
          </button>
        </section>
      ) : (
        <section className="hero">
          <h1 className="display display--xl">No workouts yet</h1>
          <a className="btn btn--primary" href={href('/workouts')}>
            Create a workout
          </a>
        </section>
      )}

      <section className="rail" aria-label="Start a different workout">
        {ordered.length > 1 ? <span className="rail__or muted">Or start</span> : null}
        {ordered.filter((w) => unfinished || w.id !== next?.id).map((w) => (
          <button key={w.id} type="button" className="rail__item" onClick={() => start(w.id)} aria-label={`Start ${w.name}`}>
            <span className="rail__code">{w.code}</span>
            <span className="rail__label">Start</span>
          </button>
        ))}
      </section>

      <section className="panel" aria-labelledby="week-h">
        <div className="panel__head">
          <h2 id="week-h">This week</h2>
          <span className="muted num">{thisWeek === 0 ? 'No sessions logged' : `${thisWeek} session${thisWeek === 1 ? '' : 's'}`}</span>
        </div>
        <ol className="week">
          {days.map((d) => {
            const codes = activity.get(d) ?? [];
            const date = new Date(`${d}T12:00:00`);
            const wd = date.toLocaleDateString(undefined, { weekday: 'narrow' });
            const full = date.toLocaleDateString(undefined, { weekday: 'long' });
            return (
              <li key={d} className={`week__day${codes.length ? ' week__day--on' : ''}${d === today ? ' week__day--today' : ''}`}>
                <span className="week__wd" aria-hidden="true">{wd}</span>
                <span className="week__mark" aria-hidden="true">{codes.join('') || ''}</span>
                <span className="sr-only">
                  {full}: {codes.length ? `Workout ${codes.join(', ')} completed` : 'no session'}
                  {d === today ? ' (today)' : ''}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="panel" aria-labelledby="last-h">
        <div className="panel__head">
          <h2 id="last-h">Last completed</h2>
          <span className="muted">Rotation {ordered.map((w) => w.code).join(' → ')}</span>
        </div>
        {last ? (
          <a className="row-link" href={href(`/history/${last.id}`)}>
            <span className="row-link__code">{last.workoutCode}</span>
            <span className="row-link__main">
              <strong>{last.workoutName}</strong>
              <span className="muted">
                {formatDate(last.endedAt ?? last.startedAt)} · {formatDuration(durationMs(last))}
              </span>
            </span>
            <Icon name="right" />
          </a>
        ) : (
          <p className="muted">Finish a session and it will show up here.</p>
        )}
      </section>

      <a className="row-link row-link--quiet" href={href('/recovery')}>
        <span className="row-link__icon">
          <Icon name="recovery" />
        </span>
        <span className="row-link__main">
          <strong>Mobility and recovery</strong>
          <span className="muted">{recoveryRoutines[0]?.movements.length ?? 0} gentle movements · separate from workouts</span>
        </span>
        <Icon name="right" />
      </a>

      {replacing && unfinished ? (
        <ConfirmDialog
          title="You have a session in progress"
          body={
            <p>
              {unfinished.workoutName} is still open. Continue it, or end it and start a new one. Ending keeps everything you
              logged in history as an unfinished session.
            </p>
          }
          confirmLabel="End it and start new"
          cancelLabel="Keep current session"
          destructive
          onCancel={() => setReplacing(null)}
          onConfirm={async () => {
            await actions.saveSession(abandon(unfinished));
            const s = await actions.startSession(replacing);
            setReplacing(null);
            navigate(`/session/${s.id}`);
          }}
        />
      ) : null}
    </div>
  );
}
