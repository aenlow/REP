import { useEffect, useMemo, useState } from 'react';
import { useData } from '../../app/store';
import { href, navigate } from '../../app/router';
import type { Exercise, LoadKind, Slot, WorkoutTemplate } from '../../types';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { Stepper } from '../../components/Stepper';
import { ExercisePicker, type PickOption } from '../../components/ExercisePicker';
import { ConflictList } from '../../components/ConflictList';
import { checkExerciseSet, hasBlocking, missingEquipment } from '../../lib/conflicts';
import { estimatedMinutes, templateConflicts, validateTemplate } from '../../lib/validate';
import { formatWeight, fromDisplay, toDisplay, weightStep } from '../../lib/units';
import { repsLabel } from '../../lib/format';
import { uid } from '../../lib/id';
import { unfinishedSession } from '../../lib/history';

const LOAD_KIND_LABEL: Record<LoadKind, string> = {
  historical: 'Known working weight',
  suggested: 'Suggested starting weight',
  bodyweight: 'Bodyweight',
  unset: 'Not set yet',
};

export function loadLabel(loadLb: number | null, kind: LoadKind, unit: 'lb' | 'kg'): string {
  if (kind === 'bodyweight') return 'Bodyweight';
  if (loadLb === null || kind === 'unset') return 'Weight not set';
  return `${formatWeight(loadLb, unit)}${kind === 'suggested' ? ' (suggested)' : ''}`;
}

type Picking = { mode: 'add'; block: number } | { mode: 'replace'; block: number; slot: number };

export function WorkoutEditor({ id }: { id: string }) {
  const { workouts, exercises, settings, sessions, actions } = useData();
  const original = workouts.find((w) => w.id === id);
  const [draft, setDraft] = useState<WorkoutTemplate | null>(original ? structuredClone(original) : null);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [editing, setEditing] = useState<{ block: number; slot: number } | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'delete' | 'discard' | null>(null);

  useEffect(() => {
    if (original && (!draft || draft.id !== original.id)) setDraft(structuredClone(original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original?.id, draft === null]);

  const lookup = useMemo(() => {
    const m = new Map(exercises.map((e) => [e.id, e]));
    return (x: string) => m.get(x);
  }, [exercises]);

  if (original && !draft) return null;
  if (!original || !draft) {
    return (
      <div className="page">
        <p className="empty">That workout no longer exists.</p>
        <a className="btn btn--ghost" href={href('/workouts')}>Back to workouts</a>
      </div>
    );
  }

  const comparable = (w: WorkoutTemplate) => JSON.stringify([w.name, w.focus, w.blocks, w.minutesPerRound]);
  const dirty = comparable(draft) !== comparable(original);
  const issues = validateTemplate(draft, exercises);
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const conflicts = templateConflicts(draft, exercises, settings);
  const blocked = conflicts.some((c) => hasBlocking(c.conflicts));
  const openSession = unfinishedSession(sessions);
  const sessionOnThis = openSession?.workoutId === draft.id;

  const mutate = (fn: (w: WorkoutTemplate) => void) =>
    setDraft((d) => {
      const n = structuredClone(d!);
      fn(n);
      return n;
    });

  const confirmPair = (key: string) => actions.updateSettings({ verifiedCablePairs: [...settings.verifiedCablePairs, key] });

  const pickOptions = (p: Picking): PickOption[] => {
    const b = draft.blocks[p.block]!;
    const others = b.slots.filter((_, i) => p.mode === 'add' || i !== p.slot).map((s) => lookup(s.exerciseId)).filter((e): e is Exercise => !!e);
    return [...exercises]
      .sort((a, z) => a.name.localeCompare(z.name))
      .map((e) => {
        const c = checkExerciseSet([...others, e], settings);
        const blocking = c.find((x) => x.severity === 'blocked');
        const missing = missingEquipment(e, settings.ownedEquipment);
        return {
          exercise: e,
          ...(blocking
            ? { blockedReason: blocking.message }
            : missing.length
              ? { blockedReason: 'Needs equipment you have marked as unavailable.' }
              : e.availability === 'restricted'
                ? { note: 'Marked temporarily restricted.' }
                : {}),
        };
      });
  };

  const onPick = (e: Exercise) => {
    if (!picking) return;
    mutate((w) => {
      const b = w.blocks[picking.block]!;
      if (picking.mode === 'add') {
        b.slots.push({
          id: uid('slot'),
          exerciseId: e.id,
          prescription: {
            repsMin: 8,
            repsMax: 12,
            perSide: !!e.perSide,
            setsPerRound: 1,
            loadLb: null,
            loadKind: e.loadType === 'bodyweight' ? 'bodyweight' : 'unset',
          },
        });
      } else {
        b.slots[picking.slot]!.exerciseId = e.id;
      }
    });
    setPicking(null);
  };

  const move = (bi: number, si: number, d: -1 | 1) =>
    mutate((w) => {
      const s = w.blocks[bi]!.slots;
      const j = si + d;
      if (j < 0 || j >= s.length) return;
      [s[si], s[j]] = [s[j]!, s[si]!];
    });

  const moveToBlock = (bi: number, si: number, target: number) =>
    mutate((w) => {
      const [slot] = w.blocks[bi]!.slots.splice(si, 1);
      if (slot) w.blocks[target]!.slots.push(slot);
    });

  const save = async () => {
    if (errors.length || blocked) return;
    await actions.saveWorkout(draft);
    actions.toast(`${draft.name} saved.`);
  };

  return (
    <div className="page page--editor">
      <header className="page__head">
        <a className="icon-btn" href={href('/workouts')} aria-label="Back to workouts">
          <Icon name="left" />
        </a>
        <span className="editor-code display" aria-hidden="true">{draft.code}</span>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!!openSession}
          onClick={async () => {
            if (dirty) return actions.toast('Save or discard your changes first.', 'error');
            const s = await actions.startSession(draft.id);
            navigate(`/session/${s.id}`);
          }}
        >
          Start
        </button>
      </header>

      {sessionOnThis ? (
        <p className="notice">
          <Icon name="info" size={18} /> A session of this workout is open. Edits apply to future sessions; the open one keeps the version it started with.
        </p>
      ) : null}

      <div className="form-grid">
        <label className="field">
          <span className="field__label">Name</span>
          <input value={draft.name} maxLength={80} onChange={(e) => mutate((w) => void (w.name = e.target.value))} />
        </label>
        <label className="field">
          <span className="field__label">Focus</span>
          <input value={draft.focus} maxLength={200} onChange={(e) => mutate((w) => void (w.focus = e.target.value))} />
        </label>
      </div>
      <p className="muted num">About {estimatedMinutes(draft)} min at {draft.minutesPerRound} min per round. A planning guide, not a timer.</p>

      {warnings.length ? (
        <ul className="conflicts">
          {warnings.map((w) => (
            <li key={w.message} className="conflict conflict--notice">
              <Icon name="info" size={18} />
              <div>
                <strong>Not 3×3×3</strong>
                <p>{w.message}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {draft.blocks.map((b, bi) => (
        <section key={b.id} className="block-edit" aria-labelledby={`blk-${b.id}`}>
          <header className="block-edit__head">
            <h2 id={`blk-${b.id}`} className="display display--m">
              Block <span className="num">{String(bi + 1).padStart(2, '0')}</span>
            </h2>
            <div className="rounds-control">
              <Stepper label="Rounds" value={b.rounds} step={1} min={1} max={10} onChange={(v) => mutate((w) => void (w.blocks[bi]!.rounds = v ?? 3))} />
            </div>
          </header>
          <ConflictList conflicts={conflicts[bi]?.conflicts ?? []} onConfirmPair={confirmPair} />
          <ol className="slot-list">
            {b.slots.map((s, si) => {
              const e = lookup(s.exerciseId);
              const p = s.prescription;
              return (
                <li key={s.id} className="slot">
                  <span className="slot__pos num" aria-hidden="true">{si + 1}</span>
                  <div className="slot__main">
                    <strong>{e?.name ?? 'Missing exercise'}</strong>
                    <span className="muted num">
                      {b.rounds * p.setsPerRound} × {repsLabel(p.repsMin, p.repsMax, p.perSide)} · {loadLabel(p.loadLb, p.loadKind, settings.unit)}
                    </span>
                    {p.notes ? <span className="slot__note">{p.notes}</span> : null}
                  </div>
                  <div className="slot__tools">
                    <button type="button" className="icon-btn" onClick={() => setEditing({ block: bi, slot: si })} aria-label={`Edit ${e?.name ?? 'exercise'}`}>
                      <Icon name="edit" />
                    </button>
                    <button type="button" className="icon-btn" onClick={() => move(bi, si, -1)} disabled={si === 0} aria-label={`Move ${e?.name} up`}>
                      <Icon name="up" />
                    </button>
                    <button type="button" className="icon-btn" onClick={() => move(bi, si, 1)} disabled={si === b.slots.length - 1} aria-label={`Move ${e?.name} down`}>
                      <Icon name="down" />
                    </button>
                  </div>
                  {draft.blocks.length > 1 ? (
                    <label className="slot__move">
                      <span className="sr-only">Move {e?.name} to block</span>
                      <select value={bi} onChange={(ev) => moveToBlock(bi, si, Number(ev.target.value))}>
                        {draft.blocks.map((_, i) => (
                          <option key={i} value={i}>
                            Block {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setPicking({ mode: 'add', block: bi })}>
            <Icon name="plus" size={18} /> Add exercise
          </button>
        </section>
      ))}

      <div className="block-tools">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => mutate((w) => void w.blocks.push({ id: uid('block'), name: `Block ${w.blocks.length + 1}`, rounds: 3, slots: [] }))}>
          <Icon name="plus" size={18} /> Add block
        </button>
        {draft.blocks.length > 1 && draft.blocks[draft.blocks.length - 1]!.slots.length === 0 ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => mutate((w) => void w.blocks.pop())}>
            Remove empty last block
          </button>
        ) : null}
      </div>

      <div className={`savebar${dirty ? ' savebar--dirty' : ''}`} role="region" aria-label="Save changes">
        {errors.length ? <p className="savebar__msg">{errors[0]!.message}</p> : blocked ? <p className="savebar__msg">Resolve the setup conflict before saving.</p> : dirty ? <p className="savebar__msg">Unsaved changes</p> : <p className="savebar__msg muted">All changes saved</p>}
        <button type="button" className="btn btn--ghost" disabled={!dirty} onClick={() => setConfirm('discard')}>
          Discard
        </button>
        <button type="button" className="btn btn--primary" disabled={!dirty || !!errors.length || blocked} onClick={save}>
          Save workout
        </button>
      </div>

      <section className="danger-zone" aria-label="Workout actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={async () => {
            const w = await actions.createWorkout(draft.id);
            navigate(`/workouts/${w.id}`);
          }}
        >
          Duplicate as new workout
        </button>
        {draft.seeded ? (
          <button type="button" className="btn btn--ghost" onClick={() => setConfirm('reset')}>
            Reset to original
          </button>
        ) : null}
        <button type="button" className="btn btn--ghost btn--danger-text" onClick={() => setConfirm('delete')}>
          Delete workout
        </button>
      </section>

      {picking ? (
        <ExercisePicker
          title={picking.mode === 'add' ? `Add to block ${picking.block + 1}` : 'Replace exercise'}
          intro="Exercises that clash with the rest of this block's setup are locked, with the reason."
          options={pickOptions(picking)}
          onPick={onPick}
          onClose={() => setPicking(null)}
        />
      ) : null}

      {editing ? (
        <SlotDialog
          slot={draft.blocks[editing.block]!.slots[editing.slot]!}
          exercise={lookup(draft.blocks[editing.block]!.slots[editing.slot]!.exerciseId)}
          unit={settings.unit}
          onClose={() => setEditing(null)}
          onReplace={() => {
            setPicking({ mode: 'replace', ...editing });
            setEditing(null);
          }}
          onRemove={() => {
            mutate((w) => void w.blocks[editing.block]!.slots.splice(editing.slot, 1));
            setEditing(null);
          }}
          onSave={(s) => {
            mutate((w) => void (w.blocks[editing.block]!.slots[editing.slot] = s));
            setEditing(null);
          }}
        />
      ) : null}

      {confirm === 'reset' ? (
        <ConfirmDialog
          title={`Reset ${draft.name}?`}
          body={<p>Exercises, weights and rep ranges go back to the original template. Your workout history is kept.</p>}
          confirmLabel="Reset workout"
          destructive
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await actions.resetWorkout(draft.id);
            setConfirm(null);
            setDraft(null);
            actions.toast(`${draft.name} reset to the original.`);
          }}
        />
      ) : null}
      {confirm === 'delete' ? (
        <ConfirmDialog
          title={`Delete ${draft.name}?`}
          body={<p>The template is removed. Sessions you've already logged stay in history.</p>}
          confirmLabel="Delete workout"
          destructive
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await actions.deleteWorkout(draft.id);
            setConfirm(null);
            navigate('/workouts');
          }}
        />
      ) : null}
      {confirm === 'discard' ? (
        <ConfirmDialog
          title="Discard changes?"
          body={<p>Your unsaved edits to this workout will be lost.</p>}
          confirmLabel="Discard changes"
          destructive
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setDraft(structuredClone(original));
            setConfirm(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SlotDialog({
  slot,
  exercise,
  unit,
  onSave,
  onClose,
  onReplace,
  onRemove,
}: {
  slot: Slot;
  exercise: Exercise | undefined;
  unit: 'lb' | 'kg';
  onSave: (s: Slot) => void;
  onClose: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const [p, setP] = useState(structuredClone(slot.prescription));
  const display = p.loadLb === null ? null : toDisplay(p.loadLb, unit);
  return (
    <Dialog
      title={exercise?.name ?? 'Exercise'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost btn--danger-text" onClick={onRemove}>
            Remove from block
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onSave({ ...slot, prescription: p })}>
            Done
          </button>
        </>
      }
    >
      <button type="button" className="btn btn--ghost btn--block" onClick={onReplace}>
        <Icon name="swap" size={18} /> Replace exercise
      </button>
      <div className="stepper-pair">
        <Stepper label="Reps from" value={p.repsMin} step={1} min={1} max={100} onChange={(v) => setP({ ...p, repsMin: v ?? 1, repsMax: Math.max(v ?? 1, p.repsMax) })} />
        <Stepper label="Reps to" value={p.repsMax} step={1} min={p.repsMin} max={100} onChange={(v) => setP({ ...p, repsMax: v ?? p.repsMin })} />
      </div>
      <label className="check">
        <input type="checkbox" checked={p.perSide} onChange={(e) => setP({ ...p, perSide: e.target.checked })} />
        <span>Reps are per side</span>
      </label>
      <Stepper label="Sets per round" value={p.setsPerRound} step={1} min={1} max={6} onChange={(v) => setP({ ...p, setsPerRound: v ?? 1 })} />
      <fieldset className="field">
        <legend className="field__label">Weight type</legend>
        <div className="seg" role="radiogroup">
          {(Object.keys(LOAD_KIND_LABEL) as LoadKind[]).map((k) => (
            <label key={k} className="seg__opt">
              <input
                type="radio"
                name="loadKind"
                checked={p.loadKind === k}
                onChange={() => setP({ ...p, loadKind: k, loadLb: k === 'bodyweight' || k === 'unset' ? null : p.loadLb })}
              />
              <span>{LOAD_KIND_LABEL[k]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {p.loadKind === 'historical' || p.loadKind === 'suggested' ? (
        <Stepper
          label="Prescribed weight"
          unit={unit}
          value={display}
          step={weightStep(unit, exercise?.loadType)}
          max={unit === 'lb' ? 1000 : 450}
          allowEmpty
          onChange={(v) => setP({ ...p, loadLb: v === null ? null : fromDisplay(v, unit) })}
        />
      ) : null}
      <label className="field">
        <span className="field__label">Rest note</span>
        <input value={p.restNote ?? ''} maxLength={200} onChange={(e) => setP({ ...p, restNote: e.target.value })} placeholder="e.g. 60–90 s after the third exercise" />
      </label>
      <label className="field">
        <span className="field__label">Notes for this workout</span>
        <textarea rows={3} value={p.notes ?? ''} maxLength={1000} onChange={(e) => setP({ ...p, notes: e.target.value })} />
      </label>
    </Dialog>
  );
}
