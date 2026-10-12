import { describe, expect, it } from 'vitest';
import { A, B } from '../helpers';
import { createSession, finish, makeSet, setEntry } from '../../src/lib/session';
import {
  activityByDay,
  bestPerformance,
  exerciseHistory,
  lastPerformance,
  nextRecommended,
  sessionSummary,
  summaryCounts,
  weekDays,
} from '../../src/lib/history';
import { formatWeight, fromDisplay, kgToLb, lbToKg, toDisplay } from '../../src/lib/units';
import { substitute } from '../../src/lib/session';

function done(template: ReturnType<typeof A>, at: string, sets: [number, number][] = [], exerciseCursor = { block: 0, round: 0, slot: 1 }) {
  let s = createSession(template, at);
  const logs = sets.map(([w, r], i) => makeSet(s, { ...exerciseCursor, round: i }, 0, { weightLb: w, reps: r }, at));
  s = finish(s, at);
  return { s, logs };
}

describe('history calculations', () => {
  it('last and best performance use completed sessions of the same exercise only', () => {
    const one = done(A(), '2026-10-01T15:00:00.000Z', [[75, 10], [75, 9]]);
    const two = done(A(), '2026-10-05T15:00:00.000Z', [[80, 8], [75, 12]]);
    const open = createSession(A(), '2026-10-08T15:00:00.000Z');
    const openSet = makeSet(open, { block: 0, round: 0, slot: 1 }, 0, { weightLb: 200, reps: 1 });
    const sessions = [one.s, two.s, open];
    const sets = [...one.logs, ...two.logs, openSet];

    const last = lastPerformance('barbell-incline-bench', sessions, sets)!;
    expect(last.sessionId).toBe(two.s.id);
    expect(last.top).toMatchObject({ weightLb: 80, reps: 8 });
    expect(bestPerformance('barbell-incline-bench', sessions, sets)).toMatchObject({ weightLb: 80 });
    expect(exerciseHistory('barbell-incline-bench', sessions, sets)).toHaveLength(2);
    expect(lastPerformance('barbell-incline-bench', sessions, sets, two.s.id)!.sessionId).toBe(one.s.id);
  });

  it('substituted sets are not counted toward the original exercise', () => {
    let s = createSession(A(), '2026-10-01T15:00:00.000Z');
    s = substitute(s, 'a-b1-s2', 'db-incline-press');
    const set = makeSet(s, { block: 0, round: 0, slot: 1 }, 0, { weightLb: 40, reps: 10 });
    s = finish(s, '2026-10-01T16:00:00.000Z');
    expect(bestPerformance('barbell-incline-bench', [s], [set])).toBeUndefined();
    expect(bestPerformance('db-incline-press', [s], [set])).toMatchObject({ weightLb: 40 });
    const rows = sessionSummary(s, [set]);
    expect(summaryCounts(rows)).toMatchObject({ substituted: 1, sets: 1 });
  });

  it('rotation alternates A → B → A', () => {
    const ws = [B(), A()];
    expect(nextRecommended(ws, [])!.code).toBe('A');
    const a = done(A(), '2026-10-01T15:00:00.000Z').s;
    expect(nextRecommended(ws, [a])!.code).toBe('B');
    const b = done(B(), '2026-10-02T15:00:00.000Z').s;
    expect(nextRecommended(ws, [a, b])!.code).toBe('A');
  });

  it('week view only marks days with recorded sessions', () => {
    const days = weekDays(new Date(2026, 9, 14)); // Wed 14 Oct 2026
    expect(days[0]).toBe('2026-10-12');
    expect(days[6]).toBe('2026-10-18');
    const a = done(A(), new Date(2026, 9, 13, 18).toISOString()).s;
    const map = activityByDay([a, createSession(B())]);
    expect(map.get('2026-10-13')).toEqual(['A']);
    expect(map.size).toBe(1);
  });

  it('summary separates done, skipped and unlogged', () => {
    let s = createSession(A());
    s = setEntry(s, { block: 0, round: 0, slot: 0 }, { status: 'done' });
    s = setEntry(s, { block: 0, round: 0, slot: 1 }, { status: 'skipped' });
    expect(summaryCounts(sessionSummary(s, []))).toEqual({ done: 1, skipped: 1, sets: 0, substituted: 0 });
  });
});

describe('units', () => {
  it('converts both ways', () => {
    expect(lbToKg(kgToLb(100))).toBeCloseTo(100, 6);
    expect(toDisplay(75, 'kg')).toBe(34);
    expect(toDisplay(31, 'lb')).toBe(31);
    expect(formatWeight(90, 'lb')).toBe('90 lb');
    expect(formatWeight(90, 'kg')).toBe('40.8 kg');
    expect(formatWeight(null, 'kg')).toBe('—');
  });

  it('switching unit never changes the stored value', () => {
    const stored = fromDisplay(40, 'kg');
    expect(stored).toBeCloseTo(88.185, 2);
    expect(toDisplay(stored, 'kg')).toBe(40);
    expect(fromDisplay(52.5, 'lb')).toBe(52.5);
  });
});
