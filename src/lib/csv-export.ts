import type { Exercise, Session, SetLog, Unit } from '../types';
import { toCsv } from './backup';
import { durationMs } from './session';
import { sessionSummary, summaryCounts } from './history';
import { toDisplay } from './units';

export function sessionsCsv(sessions: Session[], sets: SetLog[]): string {
  const rows: unknown[][] = [['session_id', 'workout', 'status', 'started_at', 'ended_at', 'duration_min', 'done', 'skipped', 'substituted', 'sets_logged', 'notes']];
  for (const s of [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const c = summaryCounts(sessionSummary(s, sets));
    rows.push([s.id, s.workoutName, s.status, s.startedAt, s.endedAt ?? '', Math.round(durationMs(s) / 60000), c.done, c.skipped, c.substituted, c.sets, s.notes]);
  }
  return toCsv(rows);
}

export function setsCsv(sessions: Session[], sets: SetLog[], exercises: Exercise[], unit: Unit): string {
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;
  const sess = new Map(sessions.map((s) => [s.id, s]));
  const rows: unknown[][] = [
    ['session_id', 'workout', 'date', 'block', 'round', 'set', 'exercise_id', 'exercise', `weight_${unit}`, 'reps', 'rpe', 'rir', 'source', 'note'],
  ];
  for (const x of [...sets].sort((a, b) => a.performedAt.localeCompare(b.performedAt))) {
    const s = sess.get(x.sessionId);
    rows.push([
      x.sessionId,
      s?.workoutName ?? '',
      x.performedAt,
      x.blockIndex + 1,
      x.round + 1,
      x.setIndex + 1,
      x.exerciseId,
      name(x.exerciseId),
      x.weightLb === null ? '' : toDisplay(x.weightLb, unit),
      x.reps ?? '',
      x.rpe ?? '',
      x.rir ?? '',
      x.source,
      x.note ?? '',
    ]);
  }
  return toCsv(rows);
}
