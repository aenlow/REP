import { SEED_EXERCISES } from '../src/data/exercises';
import { SEED_WORKOUTS } from '../src/data/workouts';
import type { Exercise, Settings, WorkoutTemplate } from '../src/types';
import { DEFAULT_SETTINGS } from '../src/db/db';

export const exercises: Exercise[] = structuredClone(SEED_EXERCISES);
export const A = (): WorkoutTemplate => structuredClone(SEED_WORKOUTS[0]!);
export const B = (): WorkoutTemplate => structuredClone(SEED_WORKOUTS[1]!);
export const ex = (id: string): Exercise => {
  const e = exercises.find((x) => x.id === id);
  if (!e) throw new Error(`no exercise ${id}`);
  return e;
};
export const settings = (patch: Partial<Settings> = {}): Settings => ({ ...structuredClone(DEFAULT_SETTINGS), ...patch });

let n = 0;
export const dbName = () => `rep-test-${Date.now()}-${n++}`;
