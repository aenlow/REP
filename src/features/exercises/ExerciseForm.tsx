import { useState } from 'react';
import type { CableArmPosition, CableSide, EquipmentId, Exercise, LoadType, MovementPattern, Muscle, SetupCategory } from '../../types';
import { EQUIPMENT } from '../../data/equipment';

export const MOVEMENTS: MovementPattern[] = [
  'hinge', 'horizontal push', 'incline push', 'horizontal pull', 'vertical pull', 'face pull',
  'knee extension', 'knee flexion', 'squat', 'elbow flexion', 'elbow extension', 'core stability',
];
export const MUSCLES: Muscle[] = [
  'chest', 'upper chest', 'front delts', 'rear delts', 'upper back', 'lats', 'spinal erectors', 'glutes',
  'hamstrings', 'quads', 'biceps', 'brachialis', 'triceps', 'core', 'rotator cuff', 'adductors', 'hip flexors',
];
const LOAD_TYPES: LoadType[] = ['barbell', 'ez-bar', 'dumbbell', 'cable', 'machine', 'kettlebell', 'bodyweight'];
const CATEGORIES: SetupCategory[] = ['rack', 'cable', 'machine', 'free weight', 'floor', 'hyperextension'];
const ARM_LABEL: Record<CableArmPosition, string> = {
  'lowered-into-rack': 'Lowered into the rack area',
  high: 'High',
  mid: 'Mid',
  'low-outside': 'Low, outside the rack',
};

export type ExerciseDraft = Omit<Exercise, 'id' | 'custom' | 'updatedAt'>;

export function blankExercise(): ExerciseDraft {
  return {
    name: '',
    primaryMuscles: [],
    secondaryMuscles: [],
    movement: 'horizontal push',
    loadType: 'dumbbell',
    equipment: { required: [], optional: [] },
    setup: { category: 'free weight', occupiesRack: false, bench: 'none', conflictTags: [] },
    summary: '',
    cues: [],
    setupSteps: [],
    mistakes: [],
    alternatives: [],
    availability: 'available',
    perSide: false,
    userSetup: {},
    userNotes: '',
  };
}

/** Editor for an exercise's definition and equipment constraints (custom or built-in). */
export function ExerciseForm({
  initial,
  onSubmit,
  submitLabel,
  error,
}: {
  initial: ExerciseDraft;
  onSubmit: (d: ExerciseDraft) => void;
  submitLabel: string;
  error?: React.ReactNode;
}) {
  const [d, setD] = useState<ExerciseDraft>(structuredClone(initial));
  const [cues, setCues] = useState(initial.cues.join('\n'));
  const set = (patch: Partial<ExerciseDraft>) => setD((x) => ({ ...x, ...patch }));
  const setSetup = (patch: Partial<ExerciseDraft['setup']>) => setD((x) => ({ ...x, setup: { ...x.setup, ...patch } }));
  const toggleEquip = (id: EquipmentId, on: boolean) =>
    set({ equipment: { ...d.equipment, required: on ? [...d.equipment.required, id] : d.equipment.required.filter((x) => x !== id) } });
  const isCable = d.setup.category === 'cable';

  return (
    <form
      className="ex-form"
      onSubmit={(e) => {
        e.preventDefault();
        const cleaned: ExerciseDraft = {
          ...d,
          name: d.name.trim().slice(0, 80),
          cues: cues.split('\n').map((c) => c.trim()).filter(Boolean).slice(0, 12),
          setup: isCable ? { ...d.setup, cable: d.setup.cable ?? { side: 'either', arm: 'high' } } : (() => {
            const s = { ...d.setup };
            delete s.cable;
            return s;
          })(),
        };
        onSubmit(cleaned);
      }}
    >
      <label className="field">
        <span className="field__label">Name</span>
        <input required value={d.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
      </label>
      {error}
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Movement</span>
          <select value={d.movement} onChange={(e) => set({ movement: e.target.value as MovementPattern })}>
            {MOVEMENTS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Primary muscle</span>
          <select value={d.primaryMuscles[0] ?? ''} onChange={(e) => set({ primaryMuscles: e.target.value ? [e.target.value as Muscle] : [] })}>
            <option value="">Choose…</option>
            {MUSCLES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Load type</span>
          <select value={d.loadType} onChange={(e) => set({ loadType: e.target.value as LoadType })}>
            {LOAD_TYPES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Setup category</span>
          <select value={d.setup.category} onChange={(e) => setSetup({ category: e.target.value as SetupCategory })}>
            {CATEGORIES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={!!d.perSide} onChange={(e) => set({ perSide: e.target.checked })} />
        <span>Done one side at a time</span>
      </label>

      <fieldset className="field">
        <legend className="field__label">Required equipment</legend>
        <div className="check-grid">
          {EQUIPMENT.filter((x) => !x.id.startsWith('cable-left') && !x.id.startsWith('cable-right')).map((x) => (
            <label key={x.id} className="check">
              <input type="checkbox" checked={d.equipment.required.includes(x.id)} onChange={(e) => toggleEquip(x.id, e.target.checked)} />
              <span>{x.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">Rack and bench</legend>
        <label className="check">
          <input type="checkbox" checked={d.setup.occupiesRack} onChange={(e) => setSetup({ occupiesRack: e.target.checked })} />
          <span>Uses the rack (barbell on J-hooks or safeties)</span>
        </label>
        <label className="field">
          <span className="field__label">Bench position</span>
          <select value={d.setup.bench ?? 'none'} onChange={(e) => setSetup({ bench: e.target.value as 'flat' | 'incline' | 'none' })}>
            <option value="none">No bench</option>
            <option value="flat">Flat</option>
            <option value="incline">Incline</option>
          </select>
        </label>
      </fieldset>

      {isCable ? (
        <fieldset className="field">
          <legend className="field__label">Cable setup</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Side</span>
              <select
                value={d.setup.cable?.side ?? 'either'}
                onChange={(e) => setSetup({ cable: { arm: d.setup.cable?.arm ?? 'high', side: e.target.value as CableSide } })}
              >
                <option value="either">Either side</option>
                <option value="left">Left only</option>
                <option value="right">Right only</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Cable arm position</span>
              <select
                value={d.setup.cable?.arm ?? 'high'}
                onChange={(e) => setSetup({ cable: { side: d.setup.cable?.side ?? 'either', arm: e.target.value as CableArmPosition } })}
              >
                {(Object.keys(ARM_LABEL) as CableArmPosition[]).map((k) => (
                  <option key={k} value={k}>
                    {ARM_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small">
            On the F22, a cable arm lowered into the rack area can't share a block with barbell work in the rack. Change this only if
            you rig the cable differently.
          </p>
        </fieldset>
      ) : null}

      <label className="field">
        <span className="field__label">Short description</span>
        <input value={d.summary} maxLength={300} onChange={(e) => set({ summary: e.target.value })} />
      </label>
      <label className="field">
        <span className="field__label">Technique cues (one per line)</span>
        <textarea rows={4} value={cues} onChange={(e) => setCues(e.target.value)} />
      </label>
      <button type="submit" className="btn btn--primary btn--block">
        {submitLabel}
      </button>
    </form>
  );
}
