import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '../../app/store';
import { href, navigate } from '../../app/router';
import type { Cursor, Session, SetLog } from '../../types';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import { SessionMap } from '../../components/SessionMap';
import { ExercisePicker } from '../../components/ExercisePicker';
import { ConflictList } from '../../components/ConflictList';
import { SetLogger } from './SetLogger';
import {
  abandon,
  blockComplete,
  cursorIndex,
  entryFor,
  exerciseIdFor,
  finish,
  makeSet,
  moveTo,
  nextPending,
  pause,
  positions,
  progress,
  quickComplete,
  resume,
  setEntry,
  setsForEntry,
  slotAt,
  stepCursor,
  substitute,
} from '../../lib/session';
import { checkBlock, substituteOptions } from '../../lib/conflicts';
import { lastPerformance } from '../../lib/history';
import { formatWeight } from '../../lib/units';
import { pad2, repsLabel } from '../../lib/format';
import { loadLabel } from '../workouts/WorkoutEditor';

type Modal = null | 'end' | 'quick' | 'substitute' | 'map' | 'discard';

export function ActiveWorkout({ id }: { id: string }) {
  const { sessions, setLogs, exercises, settings, actions } = useData();
  const session = sessions.find((s) => s.id === id);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);

  const lookup = useMemo(() => {
    const m = new Map(exercises.map((e) => [e.id, e]));
    return (x: string) => m.get(x);
  }, [exercises]);

  const save = useCallback(
    async (s: Session, sets: SetLog[] = [], del: string[] = []) => {
      setBusy(true);
      try {
        await actions.saveSession(s, sets, del);
      } finally {
        setBusy(false);
      }
    },
    [actions],
  );

  const go = useCallback(
    (delta: 1 | -1) => {
      if (!session) return;
      const c = stepCursor(session.snapshot, session.cursor, delta);
      if (c) void save(moveTo(session, c));
    },
    [session, save],
  );

  // Arrow keys move between exercises on keyboards — never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (modal || /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, modal]);

  const closed = session?.status === 'completed' || session?.status === 'abandoned';
  useEffect(() => {
    if (closed) navigate(`/history/${id}`, { replace: true });
  }, [closed, id]);

  if (!session) {
    return (
      <div className="page">
        <p className="empty">This session could not be found.</p>
        <a className="btn btn--ghost" href={href('/')}>Go home</a>
      </div>
    );
  }
  if (session.status === 'completed' || session.status === 'abandoned') return null;

  const t = session.snapshot;
  const c = session.cursor;
  const block = t.blocks[c.block];
  const slot = slotAt(t, c);
  if (!block || !slot) {
    return (
      <div className="page">
        <p className="empty">This session has no exercises.</p>
        <button type="button" className="btn btn--ghost" onClick={() => save(abandon(session)).then(() => navigate('/'))}>
          Close session
        </button>
      </div>
    );
  }

  const exId = exerciseIdFor(session, slot);
  const exercise = lookup(exId);
  const p = slot.prescription;
  const entry = entryFor(session, c);
  const entrySets = setsForEntry(setLogs, session.id, c, slot.id);
  const prog = progress(session);
  const idx = cursorIndex(t, c);
  const all = positions(t);
  const nextC = all[idx + 1];
  const nextSlot = nextC ? slotAt(t, nextC) : undefined;
  const nextEx = nextSlot ? lookup(exerciseIdFor(session, nextSlot)) : undefined;
  const last = lastPerformance(exId, sessions, setLogs, session.id);
  const substituted = exId !== slot.exerciseId;
  const paused = session.status === 'paused';
  const blockConflicts = checkBlock(block, lookup, settings, session.substitutions);
  const allLogged = prog.pending === 0;

  const advance = (s: Session) => {
    const n = stepCursor(s.snapshot, s.cursor, 1);
    return n ? moveTo(s, n) : s;
  };

  const logSet = async (input: { weightLb: number | null; reps: number | null; rpe?: number; rir?: number; note?: string }, editing?: SetLog) => {
    if (editing) {
      const updated: SetLog = { ...editing, ...input, updatedAt: new Date().toISOString() };
      if (input.rpe === undefined) delete updated.rpe;
      if (input.rir === undefined) delete updated.rir;
      if (!input.note) delete updated.note;
      return save(session, [updated]);
    }
    const set = makeSet(session, c, entrySets.length, input);
    const count = entrySets.length + 1;
    const next = count >= p.setsPerRound && entry.status !== 'done' ? setEntry(session, c, { status: 'done', via: 'sets', at: set.performedAt }) : session;
    await save(next, [set]);
  };

  const deleteSet = async (set: SetLog) => {
    const remaining = entrySets.length - 1;
    const next = remaining === 0 && entry.via === 'sets' ? setEntry(session, c, { status: 'pending' }) : session;
    await save(next, [], [set.id]);
  };

  const complete = async (mode?: 'log' | 'nolog') => {
    if (entrySets.length > 0) {
      const r = quickComplete(session, c, entrySets, { logPrescribed: false, source: 'prescribed-confirmed' });
      return save(advance(r.session));
    }
    if (!mode) {
      if (settings.autoLogPrescribed && (p.loadLb !== null || p.loadKind === 'bodyweight')) {
        const r = quickComplete(session, c, entrySets, { logPrescribed: true, source: 'auto-prescribed' });
        return save(advance(r.session), r.newSets);
      }
      return setModal('quick');
    }
    const r = quickComplete(session, c, entrySets, { logPrescribed: mode === 'log', source: 'prescribed-confirmed' });
    setModal(null);
    await save(advance(r.session), r.newSets);
  };

  const skip = async () => save(advance(setEntry(session, c, { status: 'skipped', at: new Date().toISOString() })));
  const undoStatus = async () => save(setEntry(session, c, { status: 'pending' }));

  const doFinish = async () => {
    await save(finish(session));
    setModal(null);
    navigate(`/history/${session.id}`, { replace: true });
  };

  const jump = (b: number, s: number) => {
    const target: Cursor =
      positions(t).find((x) => x.block === b && x.slot === s && entryFor(session, x).status === 'pending') ??
      positions(t).filter((x) => x.block === b && x.slot === s).pop()!;
    setModal(null);
    void save(moveTo(session, target));
  };

  const prescribedText = `${block.rounds * p.setsPerRound} × ${repsLabel(p.repsMin, p.repsMax, p.perSide)} reps`;

  return (
    <div className={`session${paused ? ' session--paused' : ''}`}>
      <header className="session__bar">
        <button type="button" className="icon-btn" onClick={() => setModal('end')} aria-label="End workout">
          <Icon name="close" />
        </button>
        <p className="session__title">{t.name}</p>
        <button
          type="button"
          className="icon-btn"
          onClick={() => save(paused ? resume(session) : pause(session))}
          aria-label={paused ? 'Resume workout' : 'Pause workout'}
          aria-pressed={paused}
        >
          <Icon name={paused ? 'play' : 'pause'} />
        </button>
      </header>

      <div className="session__layout">
        <div className="session__media">
          {exercise ? <ExerciseMedia exercise={exercise} /> : null}
        </div>

        <div className="session__info">
          <div className="position" aria-live="polite">
            <p className="position__line">
              <span className="position__label">Block</span>
              <span className="num">{pad2(c.block + 1)}</span>
              <span className="position__of num">/ {pad2(t.blocks.length)}</span>
            </p>
            <p className="position__line">
              <span className="position__label">Round</span>
              <span className="num">{c.round + 1}</span>
              <span className="position__of num">/ {block.rounds}</span>
            </p>
            <button type="button" className="position__map" onClick={() => setModal('map')} aria-label={`Session map. ${prog.done + prog.skipped} of ${prog.total} logged. Open to jump to an exercise.`}>
              <SessionMap session={session} />
            </button>
          </div>

          <p className="slot-pos num">
            Exercise {c.slot + 1} of {block.slots.length}
            {substituted ? <span className="tag">Substituted</span> : null}
            {entry.status === 'done' ? <span className="tag tag--done"><Icon name="check" size={14} /> Done</span> : null}
            {entry.status === 'skipped' ? <span className="tag tag--skip"><Icon name="skip" size={14} /> Skipped</span> : null}
          </p>
          <h1 className="ex-name">{exercise?.name ?? 'Missing exercise'}</h1>

          <dl className="rx">
            <div>
              <dt>Prescribed</dt>
              <dd className="num">{prescribedText}</dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd className="num">{substituted ? 'Set your own' : loadLabel(p.loadLb, p.loadKind, settings.unit)}</dd>
            </div>
            <div className="rx__wide">
              <dt>Last session</dt>
              <dd className="num">
                {last
                  ? `${last.top.weightLb !== null ? formatWeight(last.top.weightLb, settings.unit) + ' × ' : ''}${last.top.reps}${last.top.source !== 'logged' ? ' (as prescribed)' : ''}`
                  : 'No earlier log'}
              </dd>
            </div>
          </dl>

          {exercise?.caution || p.notes || exercise?.userNotes || exercise?.availability !== 'available' ? (
            <details className="notes">
              <summary>
                <Icon name="info" size={18} /> Notes{exercise?.availability === 'restricted' ? ' · marked restricted' : exercise?.availability === 'clinician-review' ? ' · needs clinician review' : ''}
              </summary>
              {exercise?.caution ? <p className="notes__caution">{exercise.caution}</p> : null}
              {p.notes ? <p>{p.notes}</p> : null}
              {exercise?.userNotes ? <p>{exercise.userNotes}</p> : null}
              {exercise?.cues.length ? (
                <ul>
                  {exercise.cues.slice(0, 3).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : null}
              {exercise ? <a href={href(`/library/${exercise.id}`)}>Full exercise details</a> : null}
            </details>
          ) : null}

          {blockConflicts.some((x) => x.severity === 'blocked') ? <ConflictList conflicts={blockConflicts.filter((x) => x.severity === 'blocked')} /> : null}

          <SetLogger
            key={`${c.block}:${c.round}:${slot.id}`}
            sets={entrySets}
            setsPerRound={p.setsPerRound}
            unit={settings.unit}
            loadType={exercise?.loadType}
            defaultWeight={guessWeight(setLogs, session, exId, substituted ? null : p.loadLb, last?.top.weightLb ?? null)}
            defaultReps={p.repsMax}
            bodyweight={p.loadKind === 'bodyweight' && !substituted}
            disabled={paused || busy}
            onLog={logSet}
            onDelete={deleteSet}
          />

          <div className="entry-tools">
            {entry.status === 'pending' ? (
              <button type="button" className="btn btn--ghost btn--small" onClick={skip} disabled={paused || busy}>
                <Icon name="skip" size={18} /> Skip
              </button>
            ) : (
              <button type="button" className="btn btn--ghost btn--small" onClick={undoStatus} disabled={paused || busy}>
                Mark not done
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setModal('substitute')} disabled={paused}>
              <Icon name="swap" size={18} /> Substitute
            </button>
          </div>

          <p className="next-up">
            <span className="next-up__label">Next</span>
            {nextEx && nextC ? (
              <span>
                {nextEx.name}
                <span className="muted num">
                  {' '}
                  · block {nextC.block + 1}, round {nextC.round + 1}
                </span>
              </span>
            ) : (
              <span>End of workout</span>
            )}
          </p>
          {blockComplete(session, c.block) && c.block < t.blocks.length - 1 ? (
            <p className="block-done">
              <Icon name="check" size={18} /> Block {c.block + 1} complete.
            </p>
          ) : null}
        </div>
      </div>

      <nav className="session__nav" aria-label="Workout navigation">
        <button type="button" className="navbtn" onClick={() => go(-1)} disabled={idx <= 0 || busy} aria-label="Previous exercise">
          <Icon name="left" size={26} />
        </button>
        {allLogged ? (
          <button type="button" className="navbtn navbtn--primary" onClick={doFinish} disabled={busy}>
            <Icon name="flag" /> Finish workout
          </button>
        ) : entry.status === 'pending' ? (
          <button type="button" className="navbtn navbtn--primary" onClick={() => complete()} disabled={paused || busy}>
            <Icon name="check" /> {entrySets.length ? 'Done' : 'Complete'}
          </button>
        ) : (
          <button
            type="button"
            className="navbtn navbtn--primary"
            onClick={() => {
              const n = nextPending(session);
              if (n) void save(moveTo(session, n));
            }}
            disabled={busy}
          >
            Next <Icon name="right" />
          </button>
        )}
        <button type="button" className="navbtn" onClick={() => go(1)} disabled={!nextC || busy} aria-label="Next exercise">
          <Icon name="right" size={26} />
        </button>
      </nav>

      {paused ? (
        <div className="paused" role="status">
          <p className="display display--xl">Paused</p>
          <p className="muted">Paused time isn't counted in the session duration.</p>
          <button type="button" className="btn btn--primary btn--tall" onClick={() => save(resume(session))}>
            <Icon name="play" /> Resume
          </button>
        </div>
      ) : null}

      {modal === 'quick' ? (
        <Dialog
          title="Complete without logged sets?"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => complete('nolog')}>
                Mark done, no numbers
              </button>
              <button type="button" className="btn btn--primary" onClick={() => complete('log')} data-autofocus>
                Log as prescribed
              </button>
            </>
          }
        >
          <p>
            Log the prescription as what you did:{' '}
            <strong className="num">
              {p.setsPerRound} × {p.loadLb !== null ? `${formatWeight(p.loadLb, settings.unit)} × ` : ''}
              {p.repsMax} reps
            </strong>{' '}
            (top of range). It will be labelled “as prescribed” in history.
          </p>
          <p className="muted small">To skip this question, turn on automatic logging in Settings.</p>
        </Dialog>
      ) : null}

      {modal === 'substitute' && exercise ? (
        <ExercisePicker
          title={`Substitute ${exercise.name}`}
          intro="For this session only — your workout template doesn't change. Locked options would clash with this block's equipment setup."
          options={substituteOptions(block, slot.id, exercises, settings, session.substitutions).map((o) => ({
            exercise: o.exercise,
            ...(o.blockedReason ? { blockedReason: o.blockedReason } : {}),
            ...(o.exercise.id === slot.exerciseId ? { note: 'Original exercise' } : o.conflicts.length ? { note: o.conflicts[0]!.message } : {}),
          }))}
          onPick={(e) => {
            setModal(null);
            void save(substitute(session, slot.id, e.id));
          }}
          onClose={() => setModal(null)}
        />
      ) : null}

      {modal === 'map' ? (
        <Dialog title="Session map" onClose={() => setModal(null)}>
          <p className="muted num">
            {prog.done} done · {prog.skipped} skipped · {prog.pending} to go. Tap an exercise to jump to it.
          </p>
          <div className="map-legend">
            {t.blocks.map((b, bi) => (
              <div key={b.id}>
                <p className="map-legend__h">Block {bi + 1}</p>
                <ol>
                  {b.slots.map((s, si) => (
                    <li key={s.id}>
                      <button type="button" className="link-btn" onClick={() => jump(bi, si)}>
                        <span className="num map-legend__n" aria-hidden="true">{si + 1}</span>
                        {lookup(exerciseIdFor(session, s))?.name}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <SessionMap session={session} onJump={jump} />
        </Dialog>
      ) : null}

      {modal === 'end' ? (
        <Dialog
          title="End workout?"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setModal(null)} data-autofocus>
                Keep training
              </button>
              <button type="button" className="btn btn--primary" onClick={doFinish}>
                Finish and save
              </button>
            </>
          }
        >
          {prog.pending > 0 ? (
            <p>
              <strong className="num">{prog.pending}</strong> of {prog.total} exercise rounds aren't logged. They'll be saved as not done.
            </p>
          ) : (
            <p>Everything is logged. Finish to see your summary.</p>
          )}
          <p className="muted small">You can also leave this screen without ending — the session stays open and can be continued from Home.</p>
          <div className="row-actions">
            <a className="btn btn--ghost btn--small" href={href('/')}>
              Leave open, go home
            </a>
            <button type="button" className="btn btn--ghost btn--small btn--danger-text" onClick={() => setModal('discard')}>
              Discard session
            </button>
          </div>
        </Dialog>
      ) : null}

      {modal === 'discard' ? (
        <ConfirmDialog
          title="Discard this session?"
          body={<p>The session and every set logged in it will be deleted from this device. This can't be undone.</p>}
          confirmLabel="Delete session"
          destructive
          onCancel={() => setModal('end')}
          onConfirm={async () => {
            await actions.deleteSession(session.id);
            navigate('/', { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}

/** Starting value for the weight control: this session's last set → prescription → last session. Never logged until confirmed. */
function guessWeight(sets: SetLog[], session: Session, exerciseId: string, prescribed: number | null, last: number | null): number | null {
  const mine = sets
    .filter((s) => s.sessionId === session.id && s.exerciseId === exerciseId && s.weightLb !== null)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0];
  return mine?.weightLb ?? prescribed ?? last;
}
