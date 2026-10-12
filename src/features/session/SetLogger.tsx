import { useState } from 'react';
import type { LoadType, SetLog, Unit } from '../../types';
import { Stepper } from '../../components/Stepper';
import { Icon } from '../../components/Icon';
import { formatWeight, fromDisplay, toDisplay, weightStep } from '../../lib/units';

export interface SetInput {
  weightLb: number | null;
  reps: number | null;
  rpe?: number;
  rir?: number;
  note?: string;
}

const SOURCE_LABEL: Record<SetLog['source'], string> = {
  logged: '',
  'prescribed-confirmed': 'as prescribed',
  'auto-prescribed': 'auto-logged as prescribed',
};

export function SetLogger({
  sets,
  setsPerRound,
  unit,
  loadType,
  defaultWeight,
  defaultReps,
  bodyweight,
  disabled,
  onLog,
  onDelete,
}: {
  sets: SetLog[];
  setsPerRound: number;
  unit: Unit;
  loadType: LoadType | undefined;
  defaultWeight: number | null;
  defaultReps: number;
  bodyweight: boolean;
  disabled?: boolean;
  onLog: (input: SetInput, editing?: SetLog) => Promise<void>;
  onDelete: (set: SetLog) => Promise<void>;
}) {
  const [editing, setEditing] = useState<SetLog | null>(null);
  const [extra, setExtra] = useState(false);
  const needMore = sets.length < setsPerRound || extra;

  return (
    <section className="sets" aria-label="Sets for this round">
      {sets.length ? (
        <ol className="sets__list">
          {sets.map((s, i) =>
            editing?.id === s.id ? (
              <li key={s.id}>
                <SetForm
                  title={`Edit set ${i + 1}`}
                  initial={s}
                  unit={unit}
                  loadType={loadType}
                  bodyweight={bodyweight && s.weightLb === null}
                  submitLabel="Save set"
                  disabled={disabled}
                  onSubmit={async (v) => {
                    await onLog(v, s);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                  onDelete={async () => {
                    await onDelete(s);
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={s.id} className="set-row">
                <span className="set-row__n num">Set {i + 1}</span>
                <span className="set-row__v num">
                  {s.weightLb !== null ? `${formatWeight(s.weightLb, unit)} × ` : ''}
                  {s.reps ?? '—'}
                  {s.rpe !== undefined ? ` · RPE ${s.rpe}` : ''}
                  {s.rir !== undefined ? ` · ${s.rir} RIR` : ''}
                </span>
                {SOURCE_LABEL[s.source] ? <span className="set-row__src">{SOURCE_LABEL[s.source]}</span> : null}
                {s.note ? <span className="set-row__note">{s.note}</span> : null}
                <button type="button" className="icon-btn" onClick={() => setEditing(s)} aria-label={`Edit set ${i + 1}`} disabled={disabled}>
                  <Icon name="edit" size={20} />
                </button>
              </li>
            ),
          )}
        </ol>
      ) : null}

      {!editing && needMore ? (
        <SetForm
          key={sets.length}
          title={`Set ${sets.length + 1}${setsPerRound > 1 ? ` of ${setsPerRound}` : ''}`}
          initial={{ weightLb: sets.at(-1)?.weightLb ?? (bodyweight ? null : defaultWeight), reps: sets.at(-1)?.reps ?? defaultReps }}
          unit={unit}
          loadType={loadType}
          bodyweight={bodyweight}
          submitLabel="Log set"
          disabled={disabled}
          onSubmit={async (v) => {
            await onLog(v);
            setExtra(false);
          }}
          {...(extra ? { onCancel: () => setExtra(false) } : {})}
        />
      ) : null}
      {!editing && !needMore ? (
        <button type="button" className="link-btn" onClick={() => setExtra(true)} disabled={disabled}>
          <Icon name="plus" size={16} /> Add another set
        </button>
      ) : null}
    </section>
  );
}

function SetForm({
  title,
  initial,
  unit,
  loadType,
  bodyweight,
  submitLabel,
  disabled,
  onSubmit,
  onCancel,
  onDelete,
}: {
  title: string;
  initial: Partial<SetLog> & { weightLb: number | null; reps: number | null };
  unit: Unit;
  loadType: LoadType | undefined;
  bodyweight: boolean;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (v: SetInput) => Promise<void>;
  onCancel?: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [weight, setWeight] = useState<number | null>(initial.weightLb === null ? null : toDisplay(initial.weightLb, unit));
  const [reps, setReps] = useState<number | null>(initial.reps);
  const [addLoad, setAddLoad] = useState(!bodyweight || initial.weightLb !== null);
  const [more, setMore] = useState(initial.rpe !== undefined || initial.rir !== undefined || !!initial.note);
  const [rpe, setRpe] = useState<number | undefined>(initial.rpe);
  const [rir, setRir] = useState<number | undefined>(initial.rir);
  const [note, setNote] = useState(initial.note ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit({
        weightLb: addLoad && weight !== null ? fromDisplay(weight, unit) : null,
        reps,
        ...(rpe !== undefined ? { rpe } : {}),
        ...(rir !== undefined ? { rir } : {}),
        ...(note.trim() ? { note: note.trim().slice(0, 500) } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="set-form" role="group" aria-label={title}>
      <p className="set-form__title">{title}</p>
      <div className="stepper-pair">
        {addLoad ? (
          <Stepper label="Weight" unit={unit} value={weight} step={weightStep(unit, loadType)} max={unit === 'lb' ? 1000 : 450} onChange={setWeight} allowEmpty />
        ) : (
          <div className="stepper stepper--bw">
            <span className="stepper__label">Weight</span>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setAddLoad(true)}>
              Bodyweight · add load
            </button>
          </div>
        )}
        <Stepper label="Reps" value={reps} step={1} min={0} max={200} onChange={setReps} />
      </div>
      <button type="button" className="link-btn" aria-expanded={more} onClick={() => setMore((m) => !m)}>
        {more ? 'Hide effort and note' : 'Add effort or note'}
      </button>
      {more ? (
        <div className="set-form__more">
          <fieldset className="field">
            <legend className="field__label">RPE (optional)</legend>
            <div className="chips">
              {[6, 7, 8, 9, 10].map((n) => (
                <button key={n} type="button" className="chip num" aria-pressed={rpe === n} onClick={() => setRpe(rpe === n ? undefined : n)}>
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="field">
            <legend className="field__label">Reps in reserve (optional)</legend>
            <div className="chips">
              {[0, 1, 2, 3, 4].map((n) => (
                <button key={n} type="button" className="chip num" aria-pressed={rir === n} onClick={() => setRir(rir === n ? undefined : n)}>
                  {n}
                  {n === 4 ? '+' : ''}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span className="field__label">Note</span>
            <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. grip slipped on rep 9" />
          </label>
        </div>
      ) : null}
      <div className="set-form__actions">
        {onDelete ? (
          <button type="button" className="btn btn--ghost btn--small btn--danger-text" onClick={onDelete} disabled={disabled || saving}>
            <Icon name="trash" size={18} /> Delete
          </button>
        ) : null}
        {onCancel ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="button" className="btn btn--solid" onClick={submit} disabled={disabled || saving || reps === null}>
          <Icon name="check" size={18} /> {submitLabel}
        </button>
      </div>
    </div>
  );
}
