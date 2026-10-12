import type { Session, SetLog, WorkoutTemplate } from '../types';
import { entryFor, exerciseIdFor, positions, slotAt } from './session';

export function completedSessions(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt));
}

export function unfinishedSession(sessions: Session[]): Session | undefined {
  return sessions
    .filter((s) => s.status === 'active' || s.status === 'paused')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

/** Sets that carry real numbers. Sets logged from the prescription are flagged by source. */
function numeric(s: SetLog): s is SetLog & { reps: number } {
  return s.completed && s.reps !== null && s.reps > 0;
}

/** Heaviest weight, then most reps. Bodyweight (null weight) compares by reps only. */
export function topSet(sets: SetLog[]): SetLog | undefined {
  return sets.filter(numeric).sort((a, b) => (b.weightLb ?? 0) - (a.weightLb ?? 0) || b.reps! - a.reps!)[0];
}

export interface Performance {
  sessionId: string;
  date: string;
  sets: SetLog[];
  top: SetLog;
}

/** Performances of one exercise, newest first, from completed sessions only. */
export function exerciseHistory(exerciseId: string, sessions: Session[], sets: SetLog[]): Performance[] {
  const done = completedSessions(sessions);
  const out: Performance[] = [];
  for (const s of done) {
    const mine = sets.filter((x) => x.sessionId === s.id && x.exerciseId === exerciseId);
    const top = topSet(mine);
    if (top) out.push({ sessionId: s.id, date: s.endedAt ?? s.startedAt, sets: mine, top });
  }
  return out;
}

export function lastPerformance(
  exerciseId: string,
  sessions: Session[],
  sets: SetLog[],
  excludeSessionId?: string,
): Performance | undefined {
  return exerciseHistory(
    exerciseId,
    sessions.filter((s) => s.id !== excludeSessionId),
    sets,
  )[0];
}

/**
 * Best logged set for an exercise. Only compares sets of the *same* exercise ID,
 * so substitutions and different equipment are never mixed into a "best".
 */
export function bestPerformance(exerciseId: string, sessions: Session[], sets: SetLog[]): SetLog | undefined {
  const ids = new Set(completedSessions(sessions).map((s) => s.id));
  return topSet(sets.filter((s) => s.exerciseId === exerciseId && ids.has(s.sessionId)));
}

/** Monday-start week containing `now`, as 7 local-date keys (YYYY-MM-DD). */
export function weekDays(now = new Date()): string[] {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return localDateKey(x);
  });
}

export function localDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Map of local date → completed workout codes on that date. Only real records. */
export function activityByDay(sessions: Session[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const s of completedSessions(sessions)) {
    const key = localDateKey(new Date(s.endedAt ?? s.startedAt));
    map.set(key, [...(map.get(key) ?? []), s.workoutCode]);
  }
  return map;
}

/**
 * Rotation: alternate through workouts in code order (A → B → C → A).
 * The day after A you get B, regardless of the calendar.
 */
export function nextRecommended(workouts: WorkoutTemplate[], sessions: Session[]): WorkoutTemplate | undefined {
  const ordered = [...workouts].sort((a, b) => a.code.localeCompare(b.code));
  if (ordered.length === 0) return undefined;
  const last = completedSessions(sessions)[0];
  if (!last) return ordered[0];
  const i = ordered.findIndex((w) => w.id === last.workoutId);
  if (i === -1) return ordered[0];
  return ordered[(i + 1) % ordered.length];
}

export interface SummaryRow {
  slotId: string;
  blockIndex: number;
  originalExerciseId: string;
  exerciseId: string;
  substituted: boolean;
  rounds: { round: number; status: 'pending' | 'done' | 'skipped'; sets: SetLog[] }[];
}

export function sessionSummary(session: Session, sets: SetLog[]): SummaryRow[] {
  const rows = new Map<string, SummaryRow>();
  for (const c of positions(session.snapshot)) {
    const slot = slotAt(session.snapshot, c)!;
    const exerciseId = exerciseIdFor(session, slot);
    const row =
      rows.get(slot.id) ??
      ({
        slotId: slot.id,
        blockIndex: c.block,
        originalExerciseId: slot.exerciseId,
        exerciseId,
        substituted: exerciseId !== slot.exerciseId,
        rounds: [],
      } satisfies SummaryRow);
    row.rounds.push({
      round: c.round,
      status: entryFor(session, c).status,
      sets: sets
        .filter((s) => s.sessionId === session.id && s.slotId === slot.id && s.round === c.round && s.blockIndex === c.block)
        .sort((a, b) => a.setIndex - b.setIndex),
    });
    rows.set(slot.id, row);
  }
  return [...rows.values()];
}

export function summaryCounts(rows: SummaryRow[]) {
  let done = 0;
  let skipped = 0;
  let sets = 0;
  for (const r of rows)
    for (const x of r.rounds) {
      if (x.status === 'done') done++;
      if (x.status === 'skipped') skipped++;
      sets += x.sets.filter((s) => s.completed).length;
    }
  return { done, skipped, sets, substituted: rows.filter((r) => r.substituted).length };
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
