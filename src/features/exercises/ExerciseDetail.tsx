import { useRef, useState } from 'react';
import { MAX_MEDIA_BYTES, MEDIA_TYPES, useData } from '../../app/store';
import { href, navigate } from '../../app/router';
import type { Availability, Exercise, UserSetup } from '../../types';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import { equipmentName } from '../../data/equipment';
import { bestPerformance, lastPerformance } from '../../lib/history';
import { formatWeight } from '../../lib/units';
import { formatDate, repsLabel } from '../../lib/format';
import { loadLabel } from '../workouts/WorkoutEditor';
import { ExerciseForm, blankExercise, type ExerciseDraft } from './ExerciseForm';
import { normaliseName } from '../../lib/id';

const AVAIL: { value: Availability; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'restricted', label: 'Temporarily restricted' },
  { value: 'clinician-review', label: 'Needs clinician review' },
];

const SETUP_FIELDS: { key: keyof UserSetup; label: string }[] = [
  { key: 'benchAngle', label: 'Bench angle' },
  { key: 'rackHeight', label: 'Rack / J-hook height' },
  { key: 'cableHeight', label: 'Cable height' },
  { key: 'cableSide', label: 'Cable side' },
  { key: 'attachment', label: 'Attachment' },
  { key: 'grip', label: 'Preferred grip' },
  { key: 'notes', label: 'Other setup notes' },
];

export function ExerciseDetail({ id }: { id: string }) {
  const { exercises, workouts, sessions, setLogs, settings, mediaIndex, actions } = useData();
  const ex = exercises.find((e) => e.id === id);
  const [editing, setEditing] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!ex) {
    return (
      <div className="page">
        <p className="empty">This exercise isn't in your library.</p>
        <a className="btn btn--ghost" href={href('/library')}>Back to library</a>
      </div>
    );
  }

  const uses = workouts.flatMap((w) =>
    w.blocks.flatMap((b, bi) => b.slots.filter((s) => s.exerciseId === ex.id).map((s) => ({ w, bi, s }))),
  );
  const last = lastPerformance(ex.id, sessions, setLogs);
  const best = bestPerformance(ex.id, sessions, setLogs);
  const media = mediaIndex.find((m) => m.id === ex.userMediaId);
  const save = (patch: Partial<Exercise>) => actions.saveExercise({ ...ex, ...patch });

  return (
    <div className="page page--detail">
      <header className="page__head">
        <a className="icon-btn" href={href('/library')} aria-label="Back to library">
          <Icon name="left" />
        </a>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(true)}>
          <Icon name="edit" size={18} /> Edit exercise
        </button>
      </header>

      <div className="detail-grid">
        <div>
          <ExerciseMedia exercise={ex} />
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setMediaOpen(true)}>
            {media ? 'Change or remove your media' : 'Attach your own demo'}
          </button>
        </div>
        <div>
          <h1 className="ex-name">{ex.name}</h1>
          {ex.summary ? <p className="lead">{ex.summary}</p> : null}
          {ex.caution ? (
            <p className="caution">
              <Icon name="alert" size={18} /> {ex.caution}
            </p>
          ) : null}

          <dl className="facts">
            <div>
              <dt>Primary</dt>
              <dd>{ex.primaryMuscles.join(', ') || '—'}</dd>
            </div>
            {ex.secondaryMuscles.length ? (
              <div>
                <dt>Also works</dt>
                <dd>{ex.secondaryMuscles.join(', ')}</dd>
              </div>
            ) : null}
            <div>
              <dt>Equipment</dt>
              <dd>
                {[...ex.equipment.required.map(equipmentName), ...(ex.setup.cable ? ['Cable (dual 2:1)'] : [])].join(', ') || 'None'}
                {ex.equipment.optional.length ? <span className="muted"> · optional: {ex.equipment.optional.map(equipmentName).join(', ')}</span> : null}
              </dd>
            </div>
            <div>
              <dt>Last logged</dt>
              <dd className="num">
                {last ? `${last.top.weightLb !== null ? formatWeight(last.top.weightLb, settings.unit) + ' × ' : ''}${last.top.reps} · ${formatDate(last.date)}` : 'Not logged yet'}
              </dd>
            </div>
            {best ? (
              <div>
                <dt>Best set</dt>
                <dd className="num">{best.weightLb !== null ? `${formatWeight(best.weightLb, settings.unit)} × ` : ''}{best.reps}</dd>
              </div>
            ) : null}
          </dl>

          <fieldset className="field">
            <legend className="field__label">Availability</legend>
            <div className="seg">
              {AVAIL.map((a) => (
                <label key={a.value} className="seg__opt">
                  <input type="radio" name="avail" checked={ex.availability === a.value} onChange={() => save({ availability: a.value })} />
                  <span>{a.label}</span>
                </label>
              ))}
            </div>
            <p className="muted small">A personal tracking aid — not medical clearance.</p>
          </fieldset>
        </div>
      </div>

      <section className="section">
        <h2>In your workouts</h2>
        {uses.length ? (
          <ul className="plain-list">
            {uses.map(({ w, bi, s }) => (
              <li key={s.id}>
                <a href={href(`/workouts/${w.id}`)}>
                  {w.name}, block {bi + 1}
                </a>
                <span className="muted num">
                  {' '}
                  · {repsLabel(s.prescription.repsMin, s.prescription.repsMax, s.prescription.perSide)} reps ·{' '}
                  {loadLabel(s.prescription.loadLb, s.prescription.loadKind, settings.unit)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Not in any workout.</p>
        )}
      </section>

      {ex.cues.length ? (
        <section className="section">
          <h2>Technique</h2>
          <ul className="cue-list">
            {ex.cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {ex.setupSteps.length ? (
        <section className="section">
          <h2>Setup</h2>
          <ul className="cue-list">
            {ex.setupSteps.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {ex.mistakes.length ? (
        <section className="section">
          <h2>Common mistakes</h2>
          <ul className="cue-list">
            {ex.mistakes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section">
        <h2>Your setup</h2>
        <div className="form-grid">
          {SETUP_FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span className="field__label">{f.label}</span>
              <input
                defaultValue={ex.userSetup[f.key] ?? ''}
                maxLength={200}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v === (ex.userSetup[f.key] ?? '')) return;
                  const us = { ...ex.userSetup };
                  if (v) us[f.key] = v;
                  else delete us[f.key];
                  void save({ userSetup: us });
                }}
              />
            </label>
          ))}
        </div>
        <label className="field">
          <span className="field__label">Your notes</span>
          <textarea rows={3} defaultValue={ex.userNotes} maxLength={2000} onBlur={(e) => e.target.value !== ex.userNotes && save({ userNotes: e.target.value })} />
        </label>
      </section>

      {ex.alternatives.length ? (
        <section className="section">
          <h2>Alternatives</h2>
          <ul className="plain-list">
            {ex.alternatives
              .map((a) => exercises.find((e) => e.id === a))
              .filter((e): e is Exercise => !!e)
              .map((e) => (
                <li key={e.id}>
                  <a href={href(`/library/${e.id}`)}>{e.name}</a>
                  {e.availability !== 'available' ? <span className="tag tag--warn">{AVAIL.find((x) => x.value === e.availability)?.label}</span> : null}
                </li>
              ))}
          </ul>
          <p className="muted small">During a workout, Substitute only offers alternatives that fit the block's equipment setup.</p>
        </section>
      ) : null}

      {ex.custom ? (
        <button type="button" className="btn btn--ghost btn--danger-text" onClick={() => setConfirmDelete(true)}>
          Delete custom exercise
        </button>
      ) : null}

      {editing ? (
        <Dialog title={`Edit ${ex.name}`} onClose={() => setEditing(false)} wide>
          <EditExercise ex={ex} onDone={() => setEditing(false)} />
        </Dialog>
      ) : null}
      {mediaOpen ? <MediaDialog ex={ex} hasMedia={!!media} onClose={() => setMediaOpen(false)} /> : null}
      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete ${ex.name}?`}
          body={
            uses.length ? (
              <p>It's used in {uses.length} workout slot{uses.length === 1 ? '' : 's'}. Replace it there first.</p>
            ) : (
              <p>Logged sets keep their records, listed as a deleted exercise.</p>
            )
          }
          confirmLabel={uses.length ? 'OK' : 'Delete exercise'}
          destructive={!uses.length}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            if (uses.length) return setConfirmDelete(false);
            await actions.deleteExercise(ex.id);
            navigate('/library', { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}

function EditExercise({ ex, onDone }: { ex: Exercise; onDone: () => void }) {
  const { exercises, actions } = useData();
  const [err, setErr] = useState<string | null>(null);
  return (
    <ExerciseForm
      initial={ex}
      submitLabel="Save exercise"
      error={err ? <p className="form-error" role="alert">{err}</p> : undefined}
      onSubmit={async (d: ExerciseDraft) => {
        const dup = exercises.find((e) => e.id !== ex.id && normaliseName(e.name) === normaliseName(d.name));
        if (dup) return setErr(`“${dup.name}” already exists. Choose a different name.`);
        await actions.saveExercise({ ...ex, ...d });
        actions.toast('Exercise saved.');
        onDone();
      }}
    />
  );
}

function MediaDialog({ ex, hasMedia, onClose }: { ex: Exercise; hasMedia: boolean; onClose: () => void }) {
  const { actions } = useData();
  const file = useRef<HTMLInputElement>(null);
  const [attribution, setAttribution] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog title="Your demonstration" onClose={onClose}>
      <p className="muted">
        Attach a GIF, image or short video you have the right to use — for example, a clip you filmed or media you licensed. It is stored only on
        this device and works offline. Backups don't include media files.
      </p>
      <label className="field">
        <span className="field__label">File (up to {Math.round(MAX_MEDIA_BYTES / 1024 / 1024)} MB)</span>
        <input ref={file} type="file" accept={MEDIA_TYPES.join(',')} />
      </label>
      <label className="field">
        <span className="field__label">Credit or source (optional)</span>
        <input value={attribution} maxLength={300} onChange={(e) => setAttribution(e.target.value)} placeholder="e.g. Filmed by me, Oct 2026" />
      </label>
      {err ? <p className="form-error" role="alert">{err}</p> : null}
      <div className="row-actions">
        {hasMedia ? (
          <button
            type="button"
            className="btn btn--ghost btn--danger-text"
            onClick={async () => {
              await actions.removeMedia(ex.id);
              onClose();
            }}
          >
            Remove current media
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn--primary"
          onClick={async () => {
            const f = file.current?.files?.[0];
            if (!f) return setErr('Choose a file first.');
            try {
              await actions.attachMedia(ex.id, f, attribution);
              actions.toast('Media attached.');
              onClose();
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Could not attach that file.');
            }
          }}
        >
          Save media
        </button>
      </div>
    </Dialog>
  );
}

export function NewExercise() {
  const { actions } = useData();
  const [dup, setDup] = useState<Exercise | null>(null);
  return (
    <div className="page">
      <header className="page__head">
        <a className="icon-btn" href={href('/library')} aria-label="Back to library">
          <Icon name="left" />
        </a>
        <span />
      </header>
      <h1 className="display display--l">Custom exercise</h1>
      <ExerciseForm
        initial={blankExercise()}
        submitLabel="Create exercise"
        error={
          dup ? (
            <p className="form-error" role="alert">
              You already have <a href={href(`/library/${dup.id}`)}>{dup.name}</a>. Use it, or choose a different name.
            </p>
          ) : undefined
        }
        onSubmit={async (d) => {
          const r = await actions.createExercise(d);
          if (!r.ok) return setDup(r.duplicateOf);
          actions.toast(`${r.exercise.name} added to your library.`);
          navigate(`/library/${r.exercise.id}`, { replace: true });
        }}
      />
    </div>
  );
}
