import { useEffect, useId, useState } from 'react';
import { Icon } from './Icon';
import { formatNumber } from '../lib/units';

/**
 * Large +/− control for weight and reps. Tapping the number opens the keypad,
 * but the normal training flow never requires typing.
 */
export function Stepper({
  label,
  value,
  onChange,
  step,
  min = 0,
  max = 9999,
  unit,
  placeholder = '—',
  allowEmpty,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step: number;
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value === null ? '' : formatNumber(value));
  useEffect(() => setDraft(value === null ? '' : formatNumber(value)), [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 1000) / 1000));
  const bump = (d: number) => onChange(clamp((value ?? 0) + d));
  const commit = () => {
    const t = draft.trim().replace(',', '.');
    if (t === '') return allowEmpty ? onChange(null) : setDraft(value === null ? '' : formatNumber(value));
    const n = Number(t);
    if (Number.isFinite(n)) onChange(clamp(n));
    else setDraft(value === null ? '' : formatNumber(value));
  };

  return (
    <div className="stepper">
      <label htmlFor={id} className="stepper__label">
        {label}
        {unit ? <span className="stepper__unit"> ({unit})</span> : null}
      </label>
      <div className="stepper__row">
        <button type="button" className="stepper__btn" onClick={() => bump(-step)} aria-label={`Decrease ${label} by ${formatNumber(step)}`} disabled={value !== null && value <= min}>
          <Icon name="minus" />
        </button>
        <input
          id={id}
          className="stepper__input num"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <button type="button" className="stepper__btn" onClick={() => bump(step)} aria-label={`Increase ${label} by ${formatNumber(step)}`} disabled={value !== null && value >= max}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}
