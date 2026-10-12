import type { Cursor, EntryState, Session, SetLog, SetSource, Slot, WorkoutTemplate } from '../types';
import { nowIso, uid } from './id';

/**
 * Pure session logic. A 3×3×3 session walks blocks in order; inside a block it
 * cycles exercise 1 → 2 → 3, three rounds. Each (block, round, slot) is an "entry".
 */

export function entryKey(blockIndex: number, round: number, slotId: string): string {
  return `${blockIndex}:${round}:${slotId}`;
}

export function createSession(template: WorkoutTemplate, now = nowIso()): Session {
  return {
    id: uid('session'),
    workoutId: template.id,
    workoutCode: template.code,
    workoutName: template.name,
    snapshot: structuredClone(template),
    status: 'active',
    startedAt: now,
    pausedMs: 0,
    cursor: { block: 0, round: 0, slot: 0 },
    entries: {},
    substitutions: {},
    notes: '',
    updatedAt: now,
  };
}

/** All positions in order. */
export function positions(t: WorkoutTemplate): Cursor[] {
  const out: Cursor[] = [];
  t.blocks.forEach((b, block) => {
    for (let round = 0; round < b.rounds; round++) {
      b.slots.forEach((_, slot) => out.push({ block, round, slot }));
    }
  });
  return out;
}

export function cursorIndex(t: WorkoutTemplate, c: Cursor): number {
  return positions(t).findIndex((p) => p.block === c.block && p.round === c.round && p.slot === c.slot);
}

export function stepCursor(t: WorkoutTemplate, c: Cursor, delta: 1 | -1): Cursor | null {
  const all = positions(t);
  const i = cursorIndex(t, c);
  return all[i + delta] ?? null;
}

export function slotAt(t: WorkoutTemplate, c: Cursor): Slot | undefined {
  return t.blocks[c.block]?.slots[c.slot];
}

export function exerciseIdFor(session: Session, slot: Slot): string {
  return session.substitutions[slot.id] ?? slot.exerciseId;
}

export function entryFor(session: Session, c: Cursor): EntryState {
  const slot = slotAt(session.snapshot, c);
  if (!slot) return { status: 'pending' };
  return session.entries[entryKey(c.block, c.round, slot.id)] ?? { status: 'pending' };
}

export function setsForEntry(sets: SetLog[], sessionId: string, c: Cursor, slotId: string): SetLog[] {
  return sets
    .filter((s) => s.sessionId === sessionId && s.blockIndex === c.block && s.round === c.round && s.slotId === slotId)
    .sort((a, b) => a.setIndex - b.setIndex);
}

function touch(s: Session, patch: Partial<Session>, now = nowIso()): Session {
  return { ...s, ...patch, updatedAt: now };
}

export function moveTo(session: Session, c: Cursor): Session {
  return touch(session, { cursor: c });
}

export function setEntry(session: Session, c: Cursor, state: EntryState): Session {
  const slot = slotAt(session.snapshot, c);
  if (!slot) return session;
  return touch(session, { entries: { ...session.entries, [entryKey(c.block, c.round, slot.id)]: state } });
}

export interface NewSetInput {
  weightLb: number | null;
  reps: number | null;
  rpe?: number;
  rir?: number;
  note?: string;
  source?: SetSource;
}

export function makeSet(session: Session, c: Cursor, setIndex: number, input: NewSetInput, now = nowIso()): SetLog {
  const slot = slotAt(session.snapshot, c);
  if (!slot) throw new Error('No exercise at this position');
  return {
    id: uid('set'),
    sessionId: session.id,
    slotId: slot.id,
    exerciseId: exerciseIdFor(session, slot),
    blockIndex: c.block,
    round: c.round,
    setIndex,
    weightLb: input.weightLb,
    reps: input.reps,
    ...(input.rpe !== undefined ? { rpe: input.rpe } : {}),
    ...(input.rir !== undefined ? { rir: input.rir } : {}),
    ...(input.note ? { note: input.note } : {}),
    completed: true,
    source: input.source ?? 'logged',
    performedAt: now,
    updatedAt: now,
  };
}

/**
 * Quick-complete the current entry.
 *  - If sets were already logged individually, mark done — never duplicates them.
 *  - Otherwise, with `logPrescribed`, create one set per setsPerRound from the prescription,
 *    marked as prescribed (not "actual") so history can tell them apart.
 *  - Without `logPrescribed`, mark done with no numbers recorded.
 */
export function quickComplete(
  session: Session,
  c: Cursor,
  existingSets: SetLog[],
  options: { logPrescribed: boolean; source: Extract<SetSource, 'prescribed-confirmed' | 'auto-prescribed'> },
  now = nowIso(),
): { session: Session; newSets: SetLog[] } {
  const slot = slotAt(session.snapshot, c);
  if (!slot) return { session, newSets: [] };
  if (existingSets.length > 0) {
    return { session: setEntry(session, c, { status: 'done', via: 'sets', at: now }), newSets: [] };
  }
  if (!options.logPrescribed) {
    return { session: setEntry(session, c, { status: 'done', via: 'quick-unlogged', at: now }), newSets: [] };
  }
  const p = slot.prescription;
  const newSets = Array.from({ length: p.setsPerRound }, (_, i) =>
    makeSet(session, c, i, { weightLb: p.loadLb, reps: p.repsMax, source: options.source }, now),
  );
  return { session: setEntry(session, c, { status: 'done', via: 'quick', at: now }), newSets };
}

export function substitute(session: Session, slotId: string, exerciseId: string): Session {
  const slot = session.snapshot.blocks.flatMap((b) => b.slots).find((s) => s.id === slotId);
  const subs = { ...session.substitutions };
  if (!slot || slot.exerciseId === exerciseId) delete subs[slotId];
  else subs[slotId] = exerciseId;
  return touch(session, { substitutions: subs });
}

export function pause(session: Session, now = nowIso()): Session {
  if (session.status !== 'active') return session;
  return touch(session, { status: 'paused', pausedAt: now }, now);
}

export function resume(session: Session, now = nowIso()): Session {
  if (session.status !== 'paused') return session;
  const extra = session.pausedAt ? Date.parse(now) - Date.parse(session.pausedAt) : 0;
  const next = touch(session, { status: 'active', pausedMs: session.pausedMs + Math.max(0, extra) }, now);
  delete next.pausedAt;
  return next;
}

export function finish(session: Session, now = nowIso()): Session {
  const resumed = session.status === 'paused' ? resume(session, now) : session;
  return touch(resumed, { status: 'completed', endedAt: now }, now);
}

export function abandon(session: Session, now = nowIso()): Session {
  return touch(session, { status: 'abandoned', endedAt: now }, now);
}

export function durationMs(session: Session, now = nowIso()): number {
  const end = session.endedAt ?? (session.status === 'paused' && session.pausedAt ? session.pausedAt : now);
  return Math.max(0, Date.parse(end) - Date.parse(session.startedAt) - session.pausedMs);
}

export interface Progress {
  total: number;
  done: number;
  skipped: number;
  pending: number;
}

export function progress(session: Session): Progress {
  const all = positions(session.snapshot);
  let done = 0;
  let skipped = 0;
  for (const c of all) {
    const st = entryFor(session, c).status;
    if (st === 'done') done++;
    else if (st === 'skipped') skipped++;
  }
  return { total: all.length, done, skipped, pending: all.length - done - skipped };
}

export function blockComplete(session: Session, blockIndex: number): boolean {
  return positions(session.snapshot)
    .filter((c) => c.block === blockIndex)
    .every((c) => entryFor(session, c).status !== 'pending');
}

/** First pending position at or after the cursor, wrapping to the start. */
export function nextPending(session: Session): Cursor | null {
  const all = positions(session.snapshot);
  const start = Math.max(0, cursorIndex(session.snapshot, session.cursor));
  for (let k = 0; k < all.length; k++) {
    const c = all[(start + k) % all.length]!;
    if (entryFor(session, c).status === 'pending') return c;
  }
  return null;
}
