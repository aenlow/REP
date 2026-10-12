import { useMemo, useState } from 'react';
import { useData } from '../../app/store';
import { href } from '../../app/router';
import { Icon } from '../../components/Icon';
import { EQUIPMENT } from '../../data/equipment';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import type { EquipmentId, MovementPattern, Muscle } from '../../types';

const AVAIL_LABEL = { available: '', restricted: 'Restricted', 'clinician-review': 'Clinician review' } as const;

export function Library() {
  const { exercises } = useData();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | ''>('');
  const [equip, setEquip] = useState<EquipmentId | ''>('');
  const [move, setMove] = useState<MovementPattern | ''>('');

  const muscles = useMemo(() => [...new Set(exercises.flatMap((e) => e.primaryMuscles))].sort(), [exercises]);
  const moves = useMemo(() => [...new Set(exercises.map((e) => e.movement))].sort(), [exercises]);

  const list = exercises
    .filter((e) => {
      const t = q.trim().toLowerCase();
      if (t && !`${e.name} ${e.summary}`.toLowerCase().includes(t)) return false;
      if (muscle && !e.primaryMuscles.includes(muscle) && !e.secondaryMuscles.includes(muscle)) return false;
      if (equip && !e.equipment.required.includes(equip) && !(equip.startsWith('cable-') && e.setup.category === 'cable')) return false;
      if (move && e.movement !== move) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const filtered = !!(q || muscle || equip || move);

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="display display--l">Library</h1>
        <a className="btn btn--ghost" href={href('/library/new')}>
          <Icon name="plus" size={18} /> Custom exercise
        </a>
      </header>
      <div className="filters">
        <label className="field filters__search">
          <span className="field__label">Search</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Exercise name" />
        </label>
        <label className="field">
          <span className="field__label">Muscle</span>
          <select value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle | '')}>
            <option value="">Any muscle</option>
            {muscles.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Equipment</span>
          <select value={equip} onChange={(e) => setEquip(e.target.value as EquipmentId | '')}>
            <option value="">Any equipment</option>
            {EQUIPMENT.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Movement</span>
          <select value={move} onChange={(e) => setMove(e.target.value as MovementPattern | '')}>
            <option value="">Any movement</option>
            {moves.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted num" aria-live="polite">
        {list.length} exercise{list.length === 1 ? '' : 's'}
        {filtered ? (
          <>
            {' '}·{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setQ('');
                setMuscle('');
                setEquip('');
                setMove('');
              }}
            >
              Clear filters
            </button>
          </>
        ) : null}
      </p>
      <ul className="lib-list">
        {list.map((e) => (
          <li key={e.id}>
            <a className="lib-item" href={href(`/library/${e.id}`)}>
              <ExerciseMedia exercise={e} size="small" />
              <span className="lib-item__text">
                <strong>{e.name}</strong>
                <span className="muted">
                  {e.primaryMuscles.join(', ')} · {e.movement}
                </span>
                {e.availability !== 'available' || e.custom ? (
                  <span className="lib-item__tags">
                    {e.custom ? <span className="tag">Custom</span> : null}
                    {e.availability !== 'available' ? (
                      <span className="tag tag--warn">
                        <Icon name="alert" size={12} /> {AVAIL_LABEL[e.availability]}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {list.length === 0 ? <p className="empty">No exercises match these filters.</p> : null}
    </div>
  );
}
