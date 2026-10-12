import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type {
  BodyWeightEntry,
  Exercise,
  RecoveryLog,
  RecoveryRoutine,
  Session,
  SetLog,
  Settings,
  UserMedia,
  WorkoutTemplate,
} from '../types';
import { SEED_EXERCISES } from '../data/exercises';
import { SEED_WORKOUTS } from '../data/workouts';
import { SEED_RECOVERY } from '../data/recovery';
import { DEFAULT_OWNED_EQUIPMENT } from '../data/equipment';

export const DB_NAME = 'rep';
export const DB_VERSION = 1;

export interface RepDB extends DBSchema {
  workouts: { key: string; value: WorkoutTemplate };
  exercises: { key: string; value: Exercise };
  sessions: { key: string; value: Session; indexes: { byStatus: string } };
  setLogs: { key: string; value: SetLog; indexes: { bySession: string; byExercise: string } };
  bodyWeightEntries: { key: string; value: BodyWeightEntry };
  recoveryRoutines: { key: string; value: RecoveryRoutine };
  recoveryLogs: { key: string; value: RecoveryLog };
  settings: { key: string; value: Settings };
  appMetadata: { key: string; value: { key: string; value: unknown } };
  media: { key: string; value: UserMedia };
}

export type Db = IDBPDatabase<RepDB>;
type UpgradeTx = IDBPTransaction<RepDB, StoreNames<RepDB>[], 'versionchange'>;

export const DEFAULT_SETTINGS: Settings = {
  unit: 'lb',
  autoLogPrescribed: false,
  ownedEquipment: [...DEFAULT_OWNED_EQUIPMENT],
  verifiedCablePairs: [],
  installHintDismissed: false,
};

/**
 * Ordered migrations. Each one moves the schema from (version - 1) to version.
 * Never delete user stores in a migration; transform records in place instead.
 */
export const MIGRATIONS: Record<number, (db: IDBPDatabase<RepDB>, tx: UpgradeTx) => void> = {
  1: (db) => {
    db.createObjectStore('workouts', { keyPath: 'id' });
    db.createObjectStore('exercises', { keyPath: 'id' });
    const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
    sessions.createIndex('byStatus', 'status');
    const sets = db.createObjectStore('setLogs', { keyPath: 'id' });
    sets.createIndex('bySession', 'sessionId');
    sets.createIndex('byExercise', 'exerciseId');
    db.createObjectStore('bodyWeightEntries', { keyPath: 'id' });
    db.createObjectStore('recoveryRoutines', { keyPath: 'id' });
    db.createObjectStore('recoveryLogs', { keyPath: 'id' });
    db.createObjectStore('settings');
    db.createObjectStore('appMetadata', { keyPath: 'key' });
    db.createObjectStore('media', { keyPath: 'id' });
  },
};

export async function openRepDb(name = DB_NAME, version = DB_VERSION): Promise<Db> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available in this browser.');
  const db = await openDB<RepDB>(name, version, {
    upgrade(database, oldVersion, newVersion, tx) {
      for (let v = oldVersion + 1; v <= (newVersion ?? version); v++) MIGRATIONS[v]?.(database, tx);
    },
    blocked() {
      // Another tab holds an older version open; it will be asked to close.
    },
    blocking() {
      db.close();
    },
  });
  await seed(db);
  return db;
}

/**
 * Seed built-in content. Idempotent: only adds records that don't exist,
 * so user edits to seeded workouts/exercises are never overwritten.
 */
export async function seed(db: Db): Promise<void> {
  const tx = db.transaction(['workouts', 'exercises', 'recoveryRoutines', 'settings', 'appMetadata'], 'readwrite');
  const seededWorkouts = (await tx.objectStore('appMetadata').get('seededWorkouts'))?.value as string[] | undefined;
  for (const e of SEED_EXERCISES) {
    if (!(await tx.objectStore('exercises').getKey(e.id))) await tx.objectStore('exercises').put(structuredClone(e));
  }
  // Seed workouts only once, so a user who deletes Workout A doesn't get it back silently.
  const seededSet = new Set(seededWorkouts ?? []);
  for (const w of SEED_WORKOUTS) {
    if (!seededSet.has(w.id) && !(await tx.objectStore('workouts').getKey(w.id))) {
      await tx.objectStore('workouts').put(structuredClone(w));
    }
    seededSet.add(w.id);
  }
  await tx.objectStore('appMetadata').put({ key: 'seededWorkouts', value: [...seededSet] });
  if (!(await tx.objectStore('recoveryRoutines').getKey(SEED_RECOVERY.id))) {
    const seeded = (await tx.objectStore('appMetadata').get('seededRecovery'))?.value;
    if (!seeded) await tx.objectStore('recoveryRoutines').put(structuredClone(SEED_RECOVERY));
  }
  await tx.objectStore('appMetadata').put({ key: 'seededRecovery', value: true });
  if (!(await tx.objectStore('settings').get('settings'))) {
    await tx.objectStore('settings').put(structuredClone(DEFAULT_SETTINGS), 'settings');
  }
  await tx.objectStore('appMetadata').put({ key: 'schemaVersion', value: DB_VERSION });
  await tx.done;
}

export interface Snapshot {
  workouts: WorkoutTemplate[];
  exercises: Exercise[];
  sessions: Session[];
  setLogs: SetLog[];
  bodyWeightEntries: BodyWeightEntry[];
  recoveryRoutines: RecoveryRoutine[];
  recoveryLogs: RecoveryLog[];
  settings: Settings;
  mediaIndex: { id: string; exerciseId: string; fileName: string; attribution: string; mimeType: string }[];
}

export async function loadAll(db: Db): Promise<Snapshot> {
  const [workouts, exercises, sessions, setLogs, bodyWeightEntries, recoveryRoutines, recoveryLogs, settings, media] =
    await Promise.all([
      db.getAll('workouts'),
      db.getAll('exercises'),
      db.getAll('sessions'),
      db.getAll('setLogs'),
      db.getAll('bodyWeightEntries'),
      db.getAll('recoveryRoutines'),
      db.getAll('recoveryLogs'),
      db.get('settings', 'settings'),
      db.getAll('media'),
    ]);
  return {
    workouts,
    exercises,
    sessions,
    setLogs,
    bodyWeightEntries,
    recoveryRoutines,
    recoveryLogs,
    settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) },
    mediaIndex: media.map(({ id, exerciseId, fileName, attribution, mimeType }) => ({ id, exerciseId, fileName, attribution, mimeType })),
  };
}

export const repo = {
  putWorkout: (db: Db, w: WorkoutTemplate) => db.put('workouts', w),
  deleteWorkout: (db: Db, id: string) => db.delete('workouts', id),
  putExercise: (db: Db, e: Exercise) => db.put('exercises', e),
  deleteExercise: (db: Db, id: string) => db.delete('exercises', id),
  putSession: (db: Db, s: Session) => db.put('sessions', s),
  deleteSession: async (db: Db, id: string) => {
    const tx = db.transaction(['sessions', 'setLogs'], 'readwrite');
    const keys = await tx.objectStore('setLogs').index('bySession').getAllKeys(id);
    for (const k of keys) await tx.objectStore('setLogs').delete(k);
    await tx.objectStore('sessions').delete(id);
    await tx.done;
  },
  /** Session + sets in one transaction, so a crash can't leave them out of step. */
  saveSessionAndSets: async (db: Db, s: Session, sets: SetLog[], deleteSetIds: string[] = []) => {
    const tx = db.transaction(['sessions', 'setLogs'], 'readwrite');
    await tx.objectStore('sessions').put(s);
    for (const set of sets) await tx.objectStore('setLogs').put(set);
    for (const id of deleteSetIds) await tx.objectStore('setLogs').delete(id);
    await tx.done;
  },
  putBodyWeight: (db: Db, b: BodyWeightEntry) => db.put('bodyWeightEntries', b),
  deleteBodyWeight: (db: Db, id: string) => db.delete('bodyWeightEntries', id),
  putRoutine: (db: Db, r: RecoveryRoutine) => db.put('recoveryRoutines', r),
  deleteRoutine: (db: Db, id: string) => db.delete('recoveryRoutines', id),
  putRecoveryLog: (db: Db, r: RecoveryLog) => db.put('recoveryLogs', r),
  putSettings: (db: Db, s: Settings) => db.put('settings', s, 'settings'),
  putMedia: (db: Db, m: UserMedia) => db.put('media', m),
  getMedia: (db: Db, id: string) => db.get('media', id),
  deleteMedia: (db: Db, id: string) => db.delete('media', id),
};

/** Replace everything except media blobs. Used by "replace" imports. */
export async function replaceAll(db: Db, data: Omit<Snapshot, 'mediaIndex'>): Promise<void> {
  const stores = ['workouts', 'exercises', 'sessions', 'setLogs', 'bodyWeightEntries', 'recoveryRoutines', 'recoveryLogs', 'settings'] as const;
  const tx = db.transaction([...stores], 'readwrite');
  for (const s of stores) await tx.objectStore(s).clear();
  for (const w of data.workouts) await tx.objectStore('workouts').put(w);
  for (const e of data.exercises) await tx.objectStore('exercises').put(e);
  for (const s of data.sessions) await tx.objectStore('sessions').put(s);
  for (const s of data.setLogs) await tx.objectStore('setLogs').put(s);
  for (const b of data.bodyWeightEntries) await tx.objectStore('bodyWeightEntries').put(b);
  for (const r of data.recoveryRoutines) await tx.objectStore('recoveryRoutines').put(r);
  for (const r of data.recoveryLogs) await tx.objectStore('recoveryLogs').put(r);
  await tx.objectStore('settings').put(data.settings, 'settings');
  await tx.done;
}

/** Add records with new IDs only. Existing data on this device is never overwritten. */
export async function mergeIn(db: Db, data: Omit<Snapshot, 'mediaIndex' | 'settings'>): Promise<{ added: number; skipped: number }> {
  const pairs = [
    ['workouts', data.workouts],
    ['exercises', data.exercises],
    ['sessions', data.sessions],
    ['setLogs', data.setLogs],
    ['bodyWeightEntries', data.bodyWeightEntries],
    ['recoveryRoutines', data.recoveryRoutines],
    ['recoveryLogs', data.recoveryLogs],
  ] as const;
  const tx = db.transaction(pairs.map((p) => p[0]), 'readwrite');
  let added = 0;
  let skipped = 0;
  for (const [store, items] of pairs) {
    const os = tx.objectStore(store);
    for (const item of items as { id: string }[]) {
      if (await os.getKey(item.id)) skipped++;
      else {
        await os.put(item as never);
        added++;
      }
    }
  }
  await tx.done;
  return { added, skipped };
}
