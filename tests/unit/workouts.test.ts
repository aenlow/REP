import { describe, expect, it } from 'vitest';
import { A, B, exercises, ex, settings } from '../helpers';
import { estimatedMinutes, isThreeByThreeByThree, templateConflicts, validateStructure, validateTemplate } from '../../src/lib/validate';
import { checkBlock } from '../../src/lib/conflicts';

const ids = (w: ReturnType<typeof A>) => w.blocks.map((b) => b.slots.map((s) => s.exerciseId));

describe('seeded workout definitions', () => {
  it('Workout A matches the brief, in order', () => {
    expect(ids(A())).toEqual([
      ['hyperextension', 'barbell-incline-bench', 'leg-extension'],
      ['seated-cable-row', 'cable-face-pull', 'leg-curl'],
      ['ez-bar-curl', 'cable-triceps-pressdown', 'dead-bug'],
    ]);
  });

  it('Workout B matches the brief, in order', () => {
    expect(ids(B())).toEqual([
      ['hyperextension', 'barbell-flat-bench', 'leg-curl'],
      ['seated-cable-row', 'leg-extension', 'cable-face-pull'],
      ['db-hammer-curl', 'cable-triceps-pressdown', 'supine-brace-heel-slide'],
    ]);
  });

  it('carries the prescribed reps and known loads', () => {
    const a = A();
    const rx = (b: number, s: number) => a.blocks[b]!.slots[s]!.prescription;
    expect(rx(0, 0)).toMatchObject({ repsMin: 12, repsMax: 15, loadKind: 'bodyweight', loadLb: null });
    expect(rx(0, 1)).toMatchObject({ repsMin: 8, repsMax: 12, loadLb: 75, loadKind: 'historical' });
    expect(rx(0, 2)).toMatchObject({ loadLb: 90, loadKind: 'historical' });
    expect(rx(1, 1)).toMatchObject({ repsMin: 12, repsMax: 15, loadLb: 45 });
    expect(rx(2, 0)).toMatchObject({ repsMin: 8, repsMax: 12, loadLb: 31 });
    expect(rx(2, 2)).toMatchObject({ repsMin: 6, repsMax: 10, perSide: true });
    // Unknown loads are not invented.
    expect(rx(1, 0)).toMatchObject({ loadLb: null, loadKind: 'unset' });
    expect(B().blocks[0]!.slots[1]!.prescription).toMatchObject({ loadLb: null, loadKind: 'unset' });
  });

  it('every referenced exercise exists', () => {
    const all = new Set(exercises.map((e) => e.id));
    for (const w of [A(), B()]) for (const b of w.blocks) for (const s of b.slots) expect(all.has(s.exerciseId)).toBe(true);
  });

  it('both are exactly 3×3×3 and about 45 minutes', () => {
    for (const w of [A(), B()]) {
      expect(isThreeByThreeByThree(w)).toBe(true);
      expect(validateTemplate(w, exercises)).toEqual([]);
      expect(estimatedMinutes(w)).toBe(45);
    }
  });
});

describe('3×3×3 structure validation', () => {
  it('warns (not errors) when the shape changes', () => {
    const w = A();
    w.blocks[1]!.slots.pop();
    w.blocks[2]!.rounds = 4;
    const issues = validateStructure(w);
    expect(issues.map((i) => i.level)).toEqual(['warning', 'warning']);
    expect(issues[0]!.message).toMatch(/Block 2 has 2 exercises/);
    expect(issues[1]!.message).toMatch(/Block 3 has 4 rounds/);
  });

  it('errors on invalid prescriptions', () => {
    const w = A();
    w.blocks[0]!.slots[0]!.prescription.repsMin = 15;
    w.blocks[0]!.slots[0]!.prescription.repsMax = 10;
    w.name = ' ';
    const errs = validateTemplate(w, exercises).filter((i) => i.level === 'error');
    expect(errs.map((e) => e.message)).toEqual(expect.arrayContaining(['Give the workout a name.', 'Block 1: reps must be a range like 8–12.']));
  });

  it('a Workout C can be represented with no code changes', () => {
    const c = { ...A(), id: 'workout-c', code: 'C', name: 'Workout C', seeded: false };
    expect(validateTemplate(c, exercises)).toEqual([]);
  });
});

describe('F22 rack/cable constraint in the seeded templates', () => {
  it('Workout B block 1 (rack bench) contains no exercise that lowers the cable arm', () => {
    const b1 = B().blocks[0]!;
    const lowered = b1.slots.map((s) => ex(s.exerciseId)).filter((e) => e.setup.cable?.arm === 'lowered-into-rack');
    expect(lowered).toEqual([]);
    expect(checkBlock(b1, ex, settings()).some((c) => c.severity === 'blocked')).toBe(false);
  });

  it('no seeded block has a blocking conflict', () => {
    for (const w of [A(), B()]) {
      for (const { conflicts } of templateConflicts(w, exercises, settings())) {
        expect(conflicts.filter((c) => c.severity === 'blocked')).toEqual([]);
      }
    }
  });
});
