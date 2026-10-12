import { useState } from 'react';
import { useData } from '../../app/store';
import { href, navigate } from '../../app/router';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/Dialog';
import { formatDuration, lastPerformance, sessionSummary, summaryCounts, topSet } from '../../lib/history';
import { durationMs } from '../../lib/session';
import { formatWeight } from '../../lib/units';
import { formatDateTime } from '../../lib/format';
import type { SetLog, Unit } from '../../types';

function setText(s: SetLog, unit: Unit): string {
  return `${s.weightLb !== null ? `${formatWeight(s.weightLb, unit)} × ` : ''}${s.reps ?? '—'}${s.source !== 'logged' ? '*' : ''}`;
}

export function SessionSummary({ id }: { id: string }) {
  const { sessions, setLogs, exercises, settings, actions } = useData();
  const session = sessions.find((s) => s.id === id);
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!session) {
    return (
      <div className="page">
        <p className="empty">This session isn't on this device.</p>
        <a className="btn btn--ghost" href={href('/history')}>Back to history</a>
      </div>
    );
  }
  const name = (x: string) => exercises.find((e) => e.id === x)?.name ?? 'Deleted exercise';
  const rows = sessionSummary(session, setLogs);
  const counts = summaryCounts(rows);
  const anyPrescribed = setLogs.some((s) => s.sessionId === session.id && s.source !== 'logged');
  const others = sessions.filter((s) => (s.endedAt ?? s.startedAt) < (session.endedAt ?? session.startedAt));
  const open = session.status === 'active' || session.status === 'paused';

  return (
    <div className="page">
      <header className="page__head">
        <a className="icon-btn" href={href('/history')} aria-label="Back to history">
          <Icon name="left" />
        </a>
        <span />
      </header>
      <p className="kicker">{session.status === 'completed' ? 'Workout complete' : session.status === 'abandoned' ? 'Ended early' : 'In progress'}</p>
      <h1 className="display display--xl">{session.workoutName}</h1>
      <p className="muted num">
        {formatDateTime(session.endedAt ?? session.startedAt)} · {formatDuration(durationMs(session))}
      </p>
      {open ? (
        <a className="btn btn--primary" href={href(`/session/${session.id}`)}>
          Continue workout
        </a>
      ) : null}

      <dl className="tally">
        <div>
          <dt>Completed</dt>
          <dd className="num">{counts.done}</dd>
        </div>
        <div>
          <dt>Skipped</dt>
          <dd className="num">{counts.skipped}</dd>
        </div>
        <div>
          <dt>Sets logged</dt>
          <dd className="num">{counts.sets}</dd>
        </div>
        <div>
          <dt>Substituted</dt>
          <dd className="num">{counts.substituted}</dd>
        </div>
      </dl>

      {session.snapshot.blocks.map((b, bi) => (
        <section key={b.id} className="sum-block" aria-labelledby={`sb-${b.id}`}>
          <h2 id={`sb-${b.id}`} className="sum-block__h">
            Block <span className="num">{bi + 1}</span>
          </h2>
          <ul>
            {rows
              .filter((r) => r.blockIndex === bi)
              .map((r) => {
                const mine = r.rounds.flatMap((x) => x.sets);
                const top = topSet(mine);
                const prev = lastPerformance(r.exerciseId, others, setLogs, session.id);
                return (
                  <li key={r.slotId} className="sum-row">
                    <div className="sum-row__head">
                      <a href={href(`/library/${r.exerciseId}`)}>{name(r.exerciseId)}</a>
                      {r.substituted ? <span className="tag">for {name(r.originalExerciseId)}</span> : null}
                    </div>
                    <ol className="sum-rounds">
                      {r.rounds.map((x) => (
                        <li key={x.round} className={`sum-round sum-round--${x.status}`}>
                          <span className="sum-round__n">R{x.round + 1}</span>
                          <span className="num">
                            {x.sets.length
                              ? x.sets.map((s) => setText(s, settings.unit)).join(', ')
                              : x.status === 'done'
                                ? 'Done, no numbers'
                                : x.status === 'skipped'
                                  ? 'Skipped'
                                  : 'Not done'}
                          </span>
                        </li>
                      ))}
                    </ol>
                    {top && prev ? (
                      <p className="compare muted num">
                        Previous best set: {setText(prev.top, settings.unit)} → today {setText(top, settings.unit)}
                      </p>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      {anyPrescribed ? <p className="muted small">* Logged from the prescription, not entered set by set.</p> : null}

      <label className="field">
        <span className="field__label">Session notes</span>
        <textarea
          rows={3}
          value={notes}
          maxLength={4000}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== session.notes && actions.saveSession({ ...session, notes, updatedAt: new Date().toISOString() })}
          placeholder="How did it go?"
        />
      </label>

      <div className="row-actions">
        <a className="btn btn--ghost" href={href('/')}>
          Done
        </a>
        <button type="button" className="btn btn--ghost btn--danger-text" onClick={() => setConfirmDelete(true)}>
          Delete session
        </button>
      </div>
      {confirmDelete ? (
        <ConfirmDialog
          title="Delete this session?"
          body={<p>The session and all of its sets are removed from history on this device.</p>}
          confirmLabel="Delete session"
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await actions.deleteSession(session.id);
            navigate('/history', { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}
