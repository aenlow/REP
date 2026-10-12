import { useMemo, useState } from 'react';
import { useData } from '../../app/store';
import { href } from '../../app/router';
import { Icon } from '../../components/Icon';
import { Stepper } from '../../components/Stepper';
import { bestPerformance, exerciseHistory, formatDuration, summaryCounts, sessionSummary } from '../../lib/history';
import { durationMs } from '../../lib/session';
import { formatWeight, fromDisplay, toDisplay } from '../../lib/units';
import { formatDate } from '../../lib/format';
import { nowIso, uid } from '../../lib/id';

type Tab = 'sessions' | 'exercises' | 'body';

export function History() {
  const [tab, setTab] = useState<Tab>('sessions');
  return (
    <div className="page">
      <header className="page__head">
        <h1 className="display display--l">History</h1>
      </header>
      <div className="tabs" role="tablist" aria-label="History views">
        {(
          [
            ['sessions', 'Sessions'],
            ['exercises', 'By exercise'],
            ['body', 'Body weight'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" type="button" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} className="tab" onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'sessions' ? <SessionList /> : tab === 'exercises' ? <ByExercise /> : <BodyWeight />}
      </div>
    </div>
  );
}

function SessionList() {
  const { sessions, setLogs } = useData();
  const list = [...sessions].sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt));
  const completed = list.filter((s) => s.status === 'completed').length;
  if (!list.length) return <p className="empty">No sessions yet. Your workouts appear here as soon as you start one.</p>;
  return (
    <>
      <p className="muted num">{completed} completed workout{completed === 1 ? '' : 's'}</p>
      <ul className="session-list">
        {list.map((s) => {
          const c = summaryCounts(sessionSummary(s, setLogs));
          return (
            <li key={s.id}>
              <a className="row-link" href={href(s.status === 'active' || s.status === 'paused' ? `/session/${s.id}` : `/history/${s.id}`)}>
                <span className="row-link__code">{s.workoutCode}</span>
                <span className="row-link__main">
                  <strong>
                    {formatDate(s.endedAt ?? s.startedAt)}
                    {s.status !== 'completed' ? <span className="tag">{s.status === 'abandoned' ? 'Ended early' : 'Open'}</span> : null}
                  </strong>
                  <span className="muted num">
                    {formatDuration(durationMs(s))} · {c.sets} sets · {c.done} done{c.skipped ? ` · ${c.skipped} skipped` : ''}
                    {c.substituted ? ` · ${c.substituted} substituted` : ''}
                  </span>
                </span>
                <Icon name="right" />
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ByExercise() {
  const { exercises, sessions, setLogs, settings } = useData();
  const logged = useMemo(() => {
    const ids = new Set(setLogs.map((s) => s.exerciseId));
    return exercises.filter((e) => ids.has(e.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, setLogs]);
  const [sel, setSel] = useState<string>('');
  const current = sel || logged[0]?.id || '';
  if (!logged.length) return <p className="empty">Log a set and you'll see each exercise's records here.</p>;
  const hist = exerciseHistory(current, sessions, setLogs);
  const best = bestPerformance(current, sessions, setLogs);
  return (
    <>
      <label className="field">
        <span className="field__label">Exercise</span>
        <select value={current} onChange={(e) => setSel(e.target.value)}>
          {logged.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      {best ? (
        <p className="best num">
          <span className="muted">Best logged set</span> {best.weightLb !== null ? `${formatWeight(best.weightLb, settings.unit)} × ` : ''}
          {best.reps}
        </p>
      ) : null}
      <p className="muted small">Only sets of this exact exercise are compared. Substitutes are tracked under their own name.</p>
      <table className="perf">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Sets</th>
          </tr>
        </thead>
        <tbody>
          {hist.map((h) => (
            <tr key={h.sessionId}>
              <td>
                <a href={href(`/history/${h.sessionId}`)}>{formatDate(h.date)}</a>
              </td>
              <td className="num">
                {h.sets
                  .sort((a, b) => a.round - b.round || a.setIndex - b.setIndex)
                  .map((s) => `${s.weightLb !== null ? formatWeight(s.weightLb, settings.unit) + ' × ' : ''}${s.reps ?? '—'}${s.source !== 'logged' ? '*' : ''}`)
                  .join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hist.length === 0 ? <p className="muted">Sets for this exercise are only in unfinished sessions.</p> : null}
    </>
  );
}

function BodyWeight() {
  const { bodyWeightEntries, settings, actions } = useData();
  const lastLb = [...bodyWeightEntries].sort((a, b) => b.date.localeCompare(a.date))[0]?.weightLb;
  const [value, setValue] = useState<number | null>(lastLb !== undefined ? toDisplay(lastLb, settings.unit) : null);
  const list = [...bodyWeightEntries].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="bw-form">
        <Stepper label="Body weight" unit={settings.unit} value={value} step={settings.unit === 'lb' ? 0.5 : 0.2} min={0} max={1000} onChange={setValue} allowEmpty />
        <button
          type="button"
          className="btn btn--solid"
          disabled={value === null || value <= 0}
          onClick={async () => {
            if (value === null) return;
            await actions.saveBodyWeight({ id: uid('bw'), date: nowIso(), weightLb: fromDisplay(value, settings.unit) });
            actions.toast('Body weight saved.');
          }}
        >
          Save entry
        </button>
      </div>
      {list.length ? (
        <ul className="bw-list">
          {list.map((b) => (
            <li key={b.id}>
              <span>{formatDate(b.date)}</span>
              <span className="num">{formatWeight(b.weightLb, settings.unit)}</span>
              <button type="button" className="icon-btn" aria-label={`Delete entry from ${formatDate(b.date)}`} onClick={() => actions.deleteBodyWeight(b.id)}>
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">No body-weight entries yet.</p>
      )}
    </>
  );
}
