import { describe, expect, it } from 'vitest';
import { A } from '../helpers';
import {
  abandon,
  blockComplete,
  createSession,
  cursorIndex,
  durationMs,
  entryFor,
  exerciseIdFor,
  finish,
  makeSet,
  moveTo,
  nextPending,
  pause,
  positions,
  progress,
  quickComplete,
  resume,
  setEntry,
  slotAt,
  stepCursor,
  substitute,
} from '../../src/lib/session';
import type { Session } from '../../src/types';

const T0 = '2026-10-12T15:00:00.000Z';

describe('session progression', () => {
  it('walks block → round → exercise, 27 positions', () => {
    const s = createSession(A(), T0);
    const all = positions(s.snapshot);
    expect(all).toHaveLength(27);
    expect(all.slice(0, 4)).toEqual([
      { block: 0, round: 0, slot: 0 },
      { block: 0, round: 0, slot: 1 },
      { block: 0, round: 0, slot: 2 },
      { block: 0, round: 1, slot: 0 },
    ]);
    expect(all[9]).toEqual({ block: 1, round: 0, slot: 0 });
    expect(stepCursor(s.snapshot, all[26]!, 1)).toBeNull();
    expect(stepCursor(s.snapshot, all[0]!, -1)).toBeNull();
    expect(cursorIndex(s.snapshot, all[10]!)).toBe(10);
  });

  it('freezes a snapshot so template edits do not change an open session', () => {
    const t = A();
    const s = createSession(t, T0);
    t.blocks[0]!.slots[1]!.prescription.loadLb = 999;
    expect(s.snapshot.blocks[0]!.slots[1]!.prescription.loadLb).toBe(75);
  });
});

describe('logging', () => {
  it('quick completion does not duplicate already-logged sets', () => {
    let s = createSession(A(), T0);
    const c = s.cursor;
    const set = makeSet(s, c, 0, { weightLb: 75, reps: 10 });
    const r = quickComplete(s, c, [set], { logPrescribed: true, source: 'prescribed-confirmed' });
    expect(r.newSets).toEqual([]);
    expect(entryFor(r.session, c)).toMatchObject({ status: 'done', via: 'sets' });
    s = r.session;
  });

  it('quick completion logs prescribed values only when asked, and labels them', () => {
    const s = createSession(A(), T0);
    const c = { block: 0, round: 0, slot: 1 };
    const logged = quickComplete(s, c, [], { logPrescribed: true, source: 'prescribed-confirmed' });
    expect(logged.newSets).toHaveLength(1);
    expect(logged.newSets[0]).toMatchObject({ weightLb: 75, reps: 12, source: 'prescribed-confirmed', exerciseId: 'barbell-incline-bench' });
    const unlogged = quickComplete(s, c, [], { logPrescribed: false, source: 'prescribed-confirmed' });
    expect(unlogged.newSets).toEqual([]);
    expect(entryFor(unlogged.session, c)).toMatchObject({ status: 'done', via: 'quick-unlogged' });
  });

  it('records actual weight, reps, RPE, RIR and note', () => {
    const s = createSession(A(), T0);
    const set = makeSet(s, s.cursor, 0, { weightLb: 0, reps: 14, rpe: 7, rir: 3, note: 'slow' }, T0);
    expect(set).toMatchObject({ reps: 14, rpe: 7, rir: 3, note: 'slow', source: 'logged', completed: true, blockIndex: 0, round: 0 });
  });

  it('substitution affects the session only and logs under the new exercise', () => {
    const t = A();
    let s = createSession(t, T0);
    s = substitute(s, 'a-b1-s2', 'db-incline-press');
    const slot = slotAt(s.snapshot, { block: 0, round: 0, slot: 1 })!;
    expect(exerciseIdFor(s, slot)).toBe('db-incline-press');
    expect(slot.exerciseId).toBe('barbell-incline-bench');
    expect(t.blocks[0]!.slots[1]!.exerciseId).toBe('barbell-incline-bench');
    expect(makeSet(s, { block: 0, round: 0, slot: 1 }, 0, { weightLb: 30, reps: 10 }).exerciseId).toBe('db-incline-press');
    s = substitute(s, 'a-b1-s2', 'barbell-incline-bench');
    expect(s.substitutions).toEqual({});
  });

  it('skips and tracks progress and block completion', () => {
    let s = createSession(A(), T0);
    for (const c of positions(s.snapshot).filter((p) => p.block === 0)) s = setEntry(s, c, { status: c.slot === 0 ? 'skipped' : 'done' });
    expect(blockComplete(s, 0)).toBe(true);
    expect(blockComplete(s, 1)).toBe(false);
    expect(progress(s)).toEqual({ total: 27, done: 6, skipped: 3, pending: 18 });
    expect(nextPending(s)).toEqual({ block: 1, round: 0, slot: 0 });
  });
});

describe('pause, resume, finish', () => {
  it('excludes paused time from duration', () => {
    let s = createSession(A(), T0);
    s = pause(s, '2026-10-12T15:10:00.000Z');
    s = resume(s, '2026-10-12T15:15:00.000Z');
    s = finish(s, '2026-10-12T15:50:00.000Z');
    expect(s.status).toBe('completed');
    expect(durationMs(s)).toBe(45 * 60000);
  });

  it('finishing while paused closes the pause', () => {
    let s = createSession(A(), T0);
    s = pause(s, '2026-10-12T15:10:00.000Z');
    s = finish(s, '2026-10-12T15:20:00.000Z');
    expect(durationMs(s)).toBe(10 * 60000);
  });

  it('abandon marks the session ended', () => {
    expect(abandon(createSession(A(), T0), T0).status).toBe('abandoned');
  });
});

describe('resume after reload', () => {
  it('a session survives a JSON round trip with cursor and entries intact', () => {
    let s = createSession(A(), T0);
    s = moveTo(s, { block: 1, round: 2, slot: 1 });
    s = setEntry(s, { block: 0, round: 0, slot: 0 }, { status: 'done', via: 'sets' });
    const restored = JSON.parse(JSON.stringify(s)) as Session;
    expect(restored.cursor).toEqual({ block: 1, round: 2, slot: 1 });
    expect(entryFor(restored, { block: 0, round: 0, slot: 0 }).status).toBe('done');
    expect(progress(restored).done).toBe(1);
  });
});
