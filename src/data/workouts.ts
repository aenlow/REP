import type { Block, Prescription, Slot, WorkoutTemplate } from '../types';

const SEED_DATE = '2026-10-12T00:00:00.000Z';

function rx(
  repsMin: number,
  repsMax: number,
  load: Pick<Prescription, 'loadLb' | 'loadKind'>,
  extra: Partial<Prescription> = {},
): Prescription {
  return { repsMin, repsMax, perSide: false, setsPerRound: 1, ...load, ...extra };
}

const BW = { loadLb: null, loadKind: 'bodyweight' } as const;
const UNSET = { loadLb: null, loadKind: 'unset' } as const;
const hist = (lb: number) => ({ loadLb: lb, loadKind: 'historical' as const });

function slot(id: string, exerciseId: string, prescription: Prescription): Slot {
  return { id, exerciseId, prescription };
}

function block(id: string, name: string, slots: Slot[]): Block {
  return { id, name, rounds: 3, slots };
}

export const SEED_WORKOUTS: WorkoutTemplate[] = [
  {
    id: 'workout-a',
    code: 'A',
    name: 'Workout A',
    focus: 'Full body — incline press and balanced pulling',
    seeded: true,
    version: 1,
    minutesPerRound: 5,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
    blocks: [
      block('a-b1', 'Block 1', [
        slot('a-b1-s1', 'hyperextension', rx(12, 15, BW, {
          notes: 'Only if cleared and tolerated. Do not force the end range or add load prematurely.',
        })),
        slot('a-b1-s2', 'barbell-incline-bench', rx(8, 12, hist(75), {
          notes: 'Safeties set before the first set.',
        })),
        slot('a-b1-s3', 'leg-extension', rx(12, 15, hist(90))),
      ]),
      block('a-b2', 'Block 2', [
        slot('a-b2-s1', 'seated-cable-row', rx(10, 12, UNSET, { notes: 'Record grip and attachment in setup.' })),
        slot('a-b2-s2', 'cable-face-pull', rx(12, 15, hist(45), {
          notes: 'Only when appropriate for current neck/shoulder symptoms.',
        })),
        slot('a-b2-s3', 'leg-curl', rx(12, 15, hist(90))),
      ]),
      block('a-b3', 'Block 3', [
        slot('a-b3-s1', 'ez-bar-curl', rx(8, 12, hist(31), { notes: '31 lb total, bar included.' })),
        slot('a-b3-s2', 'cable-triceps-pressdown', rx(10, 15, UNSET)),
        slot('a-b3-s3', 'dead-bug', rx(6, 10, BW, { perSide: true, notes: 'Controlled. Only if comfortable.' })),
      ]),
    ],
  },
  {
    id: 'workout-b',
    code: 'B',
    name: 'Workout B',
    focus: 'Full body — flat press and posterior-chain emphasis',
    seeded: true,
    version: 1,
    minutesPerRound: 5,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
    blocks: [
      block('b-b1', 'Block 1', [
        slot('b-b1-s1', 'hyperextension', rx(10, 15, BW, {
          notes: 'Conditional on symptom tolerance and appropriate clearance.',
        })),
        slot('b-b1-s2', 'barbell-flat-bench', rx(8, 12, UNSET, {
          notes: 'Rack safeties configured. Keep the cable arm up during this block.',
        })),
        slot('b-b1-s3', 'leg-curl', rx(12, 15, hist(90))),
      ]),
      block('b-b2', 'Block 2', [
        slot('b-b2-s1', 'seated-cable-row', rx(10, 12, UNSET)),
        slot('b-b2-s2', 'leg-extension', rx(12, 15, hist(90))),
        slot('b-b2-s3', 'cable-face-pull', rx(12, 15, hist(45), {
          notes: 'Opposite cable side where the setup permits. Only with appropriate neck/shoulder tolerance.',
        })),
      ]),
      block('b-b3', 'Block 3', [
        slot('b-b3-s1', 'db-hammer-curl', rx(10, 12, UNSET, { notes: 'Per dumbbell. Range available: 5–52.5 lb.' })),
        slot('b-b3-s2', 'cable-triceps-pressdown', rx(10, 15, UNSET)),
        slot('b-b3-s3', 'supine-brace-heel-slide', rx(6, 10, BW, {
          perSide: true,
          notes: 'Controlled. Only if comfortable and cleared.',
        })),
      ]),
    ],
  },
];

export function seedWorkout(id: string): WorkoutTemplate | undefined {
  const found = SEED_WORKOUTS.find((w) => w.id === id);
  return found ? structuredClone(found) : undefined;
}
