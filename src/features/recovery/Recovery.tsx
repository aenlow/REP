import { useState } from 'react';
import { useData } from '../../app/store';
import type { Availability, RecoveryMovement, RecoveryRoutine } from '../../types';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { Stepper } from '../../components/Stepper';
import { nowIso, uid } from '../../lib/id';
import { formatDate } from '../../lib/format';

const AVAIL_LABEL: Record<Availability, string> = {
  available: 'Available',
  restricted: 'Temporarily restricted',
  'clinician-review': 'Needs clinician review',
};
const UNIT: Record<RecoveryMovement['dose']['kind'], string> = { reps: 'reps', seconds: 's', minutes: 'min', breaths: 'breaths' };

function dose(m: RecoveryMovement): string {
  return `${m.dose.value} ${UNIT[m.dose.kind]}${m.dose.perSide ? ' / side' : ''}`;
}

export function Recovery() {
  const { recoveryRoutines, recoveryLogs, actions } = useData();
  const [selId, setSelId] = useState(recoveryRoutines[0]?.id ?? '');
  const routine = recoveryRoutines.find((r) => r.id === selId) ?? recoveryRoutines[0];
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState<RecoveryMovement | 'new' | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);
  const last = routine ? [...recoveryLogs].filter((l) => l.routineId === routine.id).sort((a, b) => b.date.localeCompare(a.date))[0] : undefined;

  const newRoutine = async (copy: boolean) => {
    const r: RecoveryRoutine = {
      id: uid('routine'),
      name: copy && routine ? `${routine.name} (my version)` : 'My routine',
      seeded: false,
      movements: copy && routine ? routine.movements.map((m) => ({ ...m, id: uid('mv') })) : [],
      updatedAt: nowIso(),
    };
    await actions.saveRoutine(r);
    setSelId(r.id);
  };

  if (!routine) {
    return (
      <div className="page">
        <h1 className="display display--l">Recovery</h1>
        <p className="empty">No routines. Create one or restore the default.</p>
        <div className="row-actions">
          <button type="button" className="btn btn--primary" onClick={() => actions.resetRoutine()}>
            Restore default routine
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => newRoutine(false)}>
            New empty routine
          </button>
        </div>
      </div>
    );
  }

  if (running) return <RunRoutine routine={routine} onExit={() => setRunning(false)} />;

  const usable = routine.movements.filter((m) => m.availability === 'available');

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="display display--l">Recovery</h1>
      </header>
      <p className="disclaimer">
        <Icon name="info" size={18} /> Gentle mobility, kept separate from your loaded workouts. Not a diagnosis or a rehab programme — stop
        anything that provokes symptoms, and follow your clinician's advice. Status labels are personal tracking aids, not medical clearance.
      </p>

      {recoveryRoutines.length > 1 ? (
        <label className="field">
          <span className="field__label">Routine</span>
          <select value={routine.id} onChange={(e) => setSelId(e.target.value)}>
            {recoveryRoutines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <section className="routine-head">
        <h2 className="display display--m">{routine.name}</h2>
        <p className="muted num">
          {usable.length} of {routine.movements.length} movements available · {last ? `last done ${formatDate(last.date)}` : 'not done yet'}
        </p>
        <button type="button" className="btn btn--primary btn--block btn--tall" disabled={!usable.length} onClick={() => setRunning(true)}>
          Start routine
        </button>
      </section>

      <ol className="mv-list">
        {routine.movements.map((m, i) => (
          <li key={m.id} className={`mv mv--${m.availability}`}>
            <span className="mv__n num" aria-hidden="true">{i + 1}</span>
            <div className="mv__main">
              <strong>{m.name}</strong>
              <span className="muted num">
                {dose(m)}
                {m.note ? ` · ${m.note}` : ''}
              </span>
              <span>{m.description}</span>
              {m.availability !== 'available' ? (
                <span className="tag tag--warn">
                  <Icon name="alert" size={12} /> {AVAIL_LABEL[m.availability]}
                </span>
              ) : null}
            </div>
            <button type="button" className="icon-btn" onClick={() => setEditing(m)} aria-label={`Edit ${m.name}`}>
              <Icon name="edit" />
            </button>
          </li>
        ))}
      </ol>

      <div className="row-actions">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} /> Add movement
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => newRoutine(true)}>
          Copy as custom routine
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => newRoutine(false)}>
          New empty routine
        </button>
        {routine.seeded ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirm('reset')}>
            Reset to default
          </button>
        ) : (
          <button type="button" className="btn btn--ghost btn--small btn--danger-text" onClick={() => setConfirm('delete')}>
            Delete routine
          </button>
        )}
      </div>

      {editing ? (
        <MovementDialog
          movement={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (m) => {
            const movements = editing === 'new' ? [...routine.movements, m] : routine.movements.map((x) => (x.id === m.id ? m : x));
            await actions.saveRoutine({ ...routine, movements });
            setEditing(null);
          }}
          onRemove={
            editing === 'new'
              ? undefined
              : async () => {
                  await actions.saveRoutine({ ...routine, movements: routine.movements.filter((x) => x.id !== editing.id) });
                  setEditing(null);
                }
          }
          onMove={
            editing === 'new'
              ? undefined
              : async (d) => {
                  const ms = [...routine.movements];
                  const i = ms.findIndex((x) => x.id === editing.id);
                  const j = i + d;
                  if (j < 0 || j >= ms.length) return;
                  [ms[i], ms[j]] = [ms[j]!, ms[i]!];
                  await actions.saveRoutine({ ...routine, movements: ms });
                }
          }
        />
      ) : null}
      {confirm === 'reset' ? (
        <ConfirmDialog
          title="Reset to the default routine?"
          body={<p>Movements, doses and statuses go back to the defaults. Your recovery log is kept.</p>}
          confirmLabel="Reset routine"
          destructive
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await actions.resetRoutine();
            setConfirm(null);
          }}
        />
      ) : null}
      {confirm === 'delete' ? (
        <ConfirmDialog
          title={`Delete ${routine.name}?`}
          body={<p>The routine is removed. Your recovery log is kept.</p>}
          confirmLabel="Delete routine"
          destructive
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await actions.deleteRoutine(routine.id);
            setSelId(recoveryRoutines.find((r) => r.id !== routine.id)?.id ?? '');
            setConfirm(null);
          }}
        />
      ) : null}
    </div>
  );
}

function MovementDialog({
  movement,
  onSave,
  onClose,
  onRemove,
  onMove,
}: {
  movement: RecoveryMovement | null;
  onSave: (m: RecoveryMovement) => void;
  onClose: () => void;
  onRemove?: () => void;
  onMove?: (d: -1 | 1) => void;
}) {
  const [m, setM] = useState<RecoveryMovement>(
    movement ?? { id: uid('mv'), name: '', description: '', dose: { kind: 'reps', value: 8 }, availability: 'available' },
  );
  return (
    <Dialog
      title={movement ? movement.name : 'Add movement'}
      onClose={onClose}
      footer={
        <>
          {onRemove ? (
            <button type="button" className="btn btn--ghost btn--danger-text" onClick={onRemove}>
              Remove
            </button>
          ) : null}
          <button type="button" className="btn btn--primary" disabled={!m.name.trim()} onClick={() => onSave({ ...m, name: m.name.trim() })}>
            Save
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field__label">Name</span>
        <input value={m.name} maxLength={80} onChange={(e) => setM({ ...m, name: e.target.value })} data-autofocus />
      </label>
      <label className="field">
        <span className="field__label">How to do it</span>
        <textarea rows={3} value={m.description} maxLength={600} onChange={(e) => setM({ ...m, description: e.target.value })} />
      </label>
      <div className="stepper-pair">
        <Stepper label="Amount" value={m.dose.value} step={m.dose.kind === 'seconds' ? 5 : 1} min={1} max={999} onChange={(v) => setM({ ...m, dose: { ...m.dose, value: v ?? 1 } })} />
        <label className="field">
          <span className="field__label">Unit</span>
          <select value={m.dose.kind} onChange={(e) => setM({ ...m, dose: { ...m.dose, kind: e.target.value as RecoveryMovement['dose']['kind'] } })}>
            <option value="reps">reps</option>
            <option value="seconds">seconds</option>
            <option value="minutes">minutes</option>
            <option value="breaths">breaths</option>
          </select>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={!!m.dose.perSide} onChange={(e) => setM({ ...m, dose: { ...m.dose, perSide: e.target.checked } })} />
        <span>Per side</span>
      </label>
      <fieldset className="field">
        <legend className="field__label">Status</legend>
        <div className="seg">
          {(Object.keys(AVAIL_LABEL) as Availability[]).map((a) => (
            <label key={a} className="seg__opt">
              <input type="radio" name="mv-avail" checked={m.availability === a} onChange={() => setM({ ...m, availability: a })} />
              <span>{AVAIL_LABEL[a]}</span>
            </label>
          ))}
        </div>
        <p className="muted small">Restricted and clinician-review movements are left out when you run the routine.</p>
      </fieldset>
      {onMove ? (
        <div className="row-actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => onMove(-1)}>
            <Icon name="up" size={18} /> Move earlier
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => onMove(1)}>
            <Icon name="down" size={18} /> Move later
          </button>
        </div>
      ) : null}
    </Dialog>
  );
}

function RunRoutine({ routine, onExit }: { routine: RecoveryRoutine; onExit: () => void }) {
  const { actions } = useData();
  const list = routine.movements.filter((m) => m.availability === 'available');
  const [state, setState] = useState<Record<string, 'done' | 'skipped'>>({});
  const finished = list.every((m) => state[m.id]);

  const finish = async () => {
    await actions.saveRecoveryLog({
      id: uid('rlog'),
      routineId: routine.id,
      date: nowIso(),
      done: list.filter((m) => state[m.id] === 'done').map((m) => m.id),
      skipped: list.filter((m) => state[m.id] !== 'done').map((m) => m.id),
    });
    actions.toast('Recovery routine logged.');
    onExit();
  };

  return (
    <div className="page">
      <header className="page__head">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Leave routine without saving">
          <Icon name="close" />
        </button>
        <span className="muted num">
          {Object.keys(state).length} / {list.length}
        </span>
      </header>
      <h1 className="display display--l">{routine.name}</h1>
      <p className="muted">Move slowly and stay in a comfortable range.</p>
      <ol className="run-list">
        {list.map((m) => (
          <li key={m.id} className={`run run--${state[m.id] ?? 'pending'}`}>
            <div>
              <strong>{m.name}</strong>
              <span className="num">{dose(m)}</span>
              <p className="muted">{m.description}</p>
            </div>
            <div className="run__actions">
              <button type="button" className="btn btn--ghost btn--small" aria-pressed={state[m.id] === 'skipped'} onClick={() => setState({ ...state, [m.id]: 'skipped' })}>
                Skip
              </button>
              <button type="button" className="btn btn--solid btn--small" aria-pressed={state[m.id] === 'done'} onClick={() => setState({ ...state, [m.id]: 'done' })}>
                <Icon name="check" size={16} /> Done
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn--primary btn--block btn--tall" onClick={finish}>
        {finished ? 'Finish routine' : 'Finish now (unmarked count as skipped)'}
      </button>
    </div>
  );
}
