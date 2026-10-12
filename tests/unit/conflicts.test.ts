import { describe, expect, it } from 'vitest';
import { A, B, exercises, ex, settings } from '../helpers';
import { checkBlock, checkExerciseSet, missingEquipment, pairKey, substituteOptions } from '../../src/lib/conflicts';
import type { Exercise } from '../../src/types';

describe('equipment conflict rules', () => {
  it('blocks rack bench + seated cable row (F22 lowered cable arm)', () => {
    const c = checkExerciseSet([ex('barbell-flat-bench'), ex('seated-cable-row')], settings());
    const blocked = c.filter((x) => x.severity === 'blocked');
    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.rule).toBe('f22-rack-cable-lowered');
    expect(blocked[0]!.message).toMatch(/lowered into the rack/);
  });

  it('applies to incline bench too', () => {
    const c = checkExerciseSet([ex('barbell-incline-bench'), ex('seated-cable-row')], settings());
    expect(c.some((x) => x.severity === 'blocked')).toBe(true);
  });

  it('putting a seated row into Workout B block 1 is blocked', () => {
    const b1 = B().blocks[0]!;
    b1.slots[2]!.exerciseId = 'seated-cable-row';
    expect(checkBlock(b1, ex, settings()).some((x) => x.severity === 'blocked')).toBe(true);
  });

  it('opposite-side cable pair needs user confirmation, then passes', () => {
    const pair = [ex('seated-cable-row'), ex('cable-face-pull')];
    const before = checkExerciseSet(pair, settings());
    expect(before).toHaveLength(1);
    expect(before[0]!.severity).toBe('confirm');
    const key = pairKey('seated-cable-row', 'cable-face-pull');
    expect(before[0]!.pairKey).toBe(key);
    expect(checkExerciseSet(pair, settings({ verifiedCablePairs: [key] }))).toEqual([]);
  });

  it('does not assume a fixed same-side cable pair can coexist', () => {
    const left = (e: Exercise): Exercise => ({ ...e, setup: { ...e.setup, cable: { side: 'left', arm: e.setup.cable!.arm } } });
    const c = checkExerciseSet([left(ex('cable-face-pull')), left(ex('cable-triceps-pressdown'))], settings());
    expect(c.map((x) => x.rule)).toContain('cable-same-side');
    expect(c.map((x) => x.rule)).not.toContain('cable-pair-unverified');
  });

  it('three cable exercises flag re-rigging', () => {
    const c = checkExerciseSet([ex('cable-face-pull'), ex('cable-triceps-pressdown'), ex('cable-curl')], settings());
    expect(c.map((x) => x.rule)).toContain('cable-sides-exhausted');
  });

  it('rack bench with a high cable is fine', () => {
    const c = checkExerciseSet([ex('barbell-flat-bench'), ex('cable-face-pull')], settings());
    expect(c.filter((x) => x.severity === 'blocked')).toEqual([]);
  });

  it('reports missing equipment', () => {
    expect(missingEquipment(ex('barbell-flat-bench'), ['barbell', 'plates', 'bench'])).toEqual(['f22-rack']);
    expect(missingEquipment(ex('cable-face-pull'), ['cable-attachments'])).toEqual(['cable-left']);
  });
});

describe('substitution engine', () => {
  it('never offers a rack-conflicting pairing as selectable', () => {
    // Swap the leg curl in B block 1 — the bench press stays, so anything lowering the cable arm must be locked.
    const b1 = B().blocks[0]!;
    const withRow = exercises.map((e) => (e.id === 'seated-cable-row' ? { ...e, movement: 'knee flexion' as const } : e));
    const opts = substituteOptions(b1, 'b-b1-s3', withRow, settings());
    const row = opts.find((o) => o.exercise.id === 'seated-cable-row');
    expect(row).toBeDefined();
    expect(row!.blockedReason).toMatch(/lowered into the rack/);
    expect(opts.filter((o) => !o.blockedReason).every((o) => o.exercise.setup.cable?.arm !== 'lowered-into-rack')).toBe(true);
  });

  it('offers listed alternatives for the incline press', () => {
    const b1 = A().blocks[0]!;
    const opts = substituteOptions(b1, 'a-b1-s2', exercises, settings());
    expect(opts[0]!.exercise.id).toBe('db-incline-press');
    expect(opts.every((o) => o.exercise.id !== 'barbell-incline-bench')).toBe(true);
  });

  it('locks options needing equipment the user does not own', () => {
    const b1 = A().blocks[0]!;
    const opts = substituteOptions(b1, 'a-b1-s2', exercises, settings({ ownedEquipment: ['f22-rack', 'barbell', 'plates', 'bench'] }));
    expect(opts.find((o) => o.exercise.id === 'db-incline-press')!.blockedReason).toMatch(/equipment/);
  });

  it('includes the original exercise to switch back after a substitution', () => {
    const b1 = A().blocks[0]!;
    const opts = substituteOptions(b1, 'a-b1-s2', exercises, settings(), { 'a-b1-s2': 'db-incline-press' });
    expect(opts[0]!.exercise.id).toBe('barbell-incline-bench');
  });

  it('locks restricted exercises', () => {
    const list = exercises.map((e) => (e.id === 'db-incline-press' ? { ...e, availability: 'restricted' as const } : e));
    const opts = substituteOptions(A().blocks[0]!, 'a-b1-s2', list, settings());
    expect(opts.find((o) => o.exercise.id === 'db-incline-press')!.blockedReason).toMatch(/restricted/);
  });
});
