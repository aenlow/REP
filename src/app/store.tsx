import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_SETTINGS,
  loadAll,
  mergeIn,
  openRepDb,
  replaceAll,
  repo,
  type Db,
  type Snapshot,
} from '../db/db';
import type {
  BackupFile,
  BodyWeightEntry,
  Exercise,
  RecoveryLog,
  RecoveryRoutine,
  Session,
  SetLog,
  Settings,
  WorkoutTemplate,
} from '../types';
import { seedWorkout } from '../data/workouts';
import { SEED_RECOVERY } from '../data/recovery';
import { createSession } from '../lib/session';
import { nowIso, normaliseName, slugify, uid } from '../lib/id';
import { buildBackup } from '../lib/backup';

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: Snapshot };

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

export interface Actions {
  updateSettings(patch: Partial<Settings>): Promise<void>;
  saveWorkout(w: WorkoutTemplate): Promise<void>;
  createWorkout(from?: string): Promise<WorkoutTemplate>;
  deleteWorkout(id: string): Promise<void>;
  resetWorkout(id: string): Promise<void>;
  saveExercise(e: Exercise): Promise<void>;
  createExercise(e: Omit<Exercise, 'id' | 'custom' | 'updatedAt'>): Promise<{ ok: true; exercise: Exercise } | { ok: false; duplicateOf: Exercise }>;
  deleteExercise(id: string): Promise<void>;
  startSession(workoutId: string): Promise<Session>;
  saveSession(s: Session, sets?: SetLog[], deleteSetIds?: string[]): Promise<void>;
  deleteSession(id: string): Promise<void>;
  saveBodyWeight(b: BodyWeightEntry): Promise<void>;
  deleteBodyWeight(id: string): Promise<void>;
  saveRoutine(r: RecoveryRoutine): Promise<void>;
  deleteRoutine(id: string): Promise<void>;
  resetRoutine(): Promise<void>;
  saveRecoveryLog(r: RecoveryLog): Promise<void>;
  attachMedia(exerciseId: string, file: File, attribution: string): Promise<void>;
  removeMedia(exerciseId: string): Promise<void>;
  getMediaBlob(mediaId: string): Promise<Blob | undefined>;
  exportBackup(): BackupFile;
  importBackup(b: BackupFile, mode: 'merge' | 'replace'): Promise<string>;
  resetSettings(): Promise<void>;
  toast(text: string, tone?: Toast['tone']): void;
}

interface Ctx {
  state: LoadState;
  actions: Actions;
  toasts: Toast[];
  dismissToast(id: number): void;
}

const StoreContext = createContext<Ctx | null>(null);

export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
export const MEDIA_TYPES = ['image/gif', 'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];

export function StoreProvider({ children, dbFactory = () => openRepDb() }: { children: ReactNode; dbFactory?: () => Promise<Db> }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dbRef = useRef<Db | null>(null);
  const dataRef = useRef<Snapshot | null>(null);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 8000 : 3200);
  }, []);

  useEffect(() => {
    let cancelled = false;
    dbFactory()
      .then(async (db) => {
        dbRef.current = db;
        const data = await loadAll(db);
        if (cancelled) return;
        dataRef.current = data;
        setState({ kind: 'ready', data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message:
            err instanceof Error && /IndexedDB is not available/.test(err.message)
              ? 'This browser has no IndexedDB storage, so REP cannot save workouts here.'
              : 'REP could not open its on-device storage. Private browsing or low storage can cause this.',
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((fn: (d: Snapshot) => Snapshot) => {
    const cur = dataRef.current;
    if (!cur) return;
    const next = fn(cur);
    dataRef.current = next;
    setState({ kind: 'ready', data: next });
  }, []);

  /** Run a DB write; only update UI state after it succeeds. Failures are surfaced, never hidden. */
  const write = useCallback(
    async (op: (db: Db) => Promise<unknown>, apply: (d: Snapshot) => Snapshot) => {
      const db = dbRef.current;
      if (!db) throw new Error('Storage is not ready');
      try {
        await op(db);
      } catch (e) {
        toast('Could not save — your last change was not stored on this device.', 'error');
        throw e;
      }
      update(apply);
    },
    [toast, update],
  );

  const actions = useMemo<Actions>(() => {
    const data = () => dataRef.current!;
    const upsert = <T extends { id: string }>(list: T[], item: T) =>
      list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

    return {
      toast,
      async updateSettings(patch) {
        const s = { ...data().settings, ...patch };
        await write((db) => repo.putSettings(db, s), (d) => ({ ...d, settings: s }));
      },
      async resetSettings() {
        const s = { ...DEFAULT_SETTINGS, lastBackupAt: data().settings.lastBackupAt } as Settings;
        if (!s.lastBackupAt) delete s.lastBackupAt;
        await write((db) => repo.putSettings(db, s), (d) => ({ ...d, settings: s }));
      },
      async saveWorkout(w) {
        const prev = data().workouts.find((x) => x.id === w.id);
        const next = { ...w, version: (prev?.version ?? 0) + 1, updatedAt: nowIso() };
        await write((db) => repo.putWorkout(db, next), (d) => ({ ...d, workouts: upsert(d.workouts, next) }));
      },
      async createWorkout(fromId) {
        const used = new Set(data().workouts.map((w) => w.code));
        let code = 'C';
        for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(c)) { code = c; break; }
        const src = fromId ? data().workouts.find((w) => w.id === fromId) : undefined;
        const now = nowIso();
        const w: WorkoutTemplate = src
          ? {
              ...structuredClone(src),
              id: uid('workout'),
              code,
              name: `Workout ${code}`,
              focus: `Copy of ${src.name}`,
              seeded: false,
              version: 1,
              createdAt: now,
              updatedAt: now,
              blocks: src.blocks.map((b) => ({ ...b, id: uid('block'), slots: b.slots.map((s) => ({ ...structuredClone(s), id: uid('slot') })) })),
            }
          : {
              id: uid('workout'),
              code,
              name: `Workout ${code}`,
              focus: '',
              seeded: false,
              version: 1,
              minutesPerRound: 5,
              createdAt: now,
              updatedAt: now,
              blocks: [1, 2, 3].map((n) => ({ id: uid('block'), name: `Block ${n}`, rounds: 3, slots: [] })),
            };
        await write((db) => repo.putWorkout(db, w), (d) => ({ ...d, workouts: [...d.workouts, w] }));
        return w;
      },
      async deleteWorkout(id) {
        await write((db) => repo.deleteWorkout(db, id), (d) => ({ ...d, workouts: d.workouts.filter((w) => w.id !== id) }));
      },
      async resetWorkout(id) {
        const orig = seedWorkout(id);
        if (!orig) return;
        const prev = data().workouts.find((w) => w.id === id);
        const next = { ...orig, version: (prev?.version ?? 0) + 1, updatedAt: nowIso() };
        await write((db) => repo.putWorkout(db, next), (d) => ({ ...d, workouts: upsert(d.workouts, next) }));
      },
      async saveExercise(e) {
        const next = { ...e, updatedAt: nowIso() };
        await write((db) => repo.putExercise(db, next), (d) => ({ ...d, exercises: upsert(d.exercises, next) }));
      },
      async createExercise(input) {
        const dup = data().exercises.find((e) => normaliseName(e.name) === normaliseName(input.name));
        if (dup) return { ok: false, duplicateOf: dup };
        let id = `custom-${slugify(input.name)}`;
        while (data().exercises.some((e) => e.id === id)) id = `${id}-${Math.floor(Math.random() * 1000)}`;
        const e: Exercise = { ...input, id, custom: true, updatedAt: nowIso() };
        await write((db) => repo.putExercise(db, e), (d) => ({ ...d, exercises: [...d.exercises, e] }));
        return { ok: true, exercise: e };
      },
      async deleteExercise(id) {
        await write((db) => repo.deleteExercise(db, id), (d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== id) }));
      },
      async startSession(workoutId) {
        const w = data().workouts.find((x) => x.id === workoutId);
        if (!w) throw new Error('Workout not found');
        const s = createSession(w);
        await write((db) => repo.putSession(db, s), (d) => ({ ...d, sessions: [...d.sessions, s] }));
        return s;
      },
      async saveSession(s, sets = [], deleteSetIds = []) {
        await write(
          (db) => repo.saveSessionAndSets(db, s, sets, deleteSetIds),
          (d) => {
            let logs = d.setLogs.filter((x) => !deleteSetIds.includes(x.id));
            for (const set of sets) logs = upsert(logs, set);
            return { ...d, sessions: upsert(d.sessions, s), setLogs: logs };
          },
        );
      },
      async deleteSession(id) {
        await write((db) => repo.deleteSession(db, id), (d) => ({
          ...d,
          sessions: d.sessions.filter((s) => s.id !== id),
          setLogs: d.setLogs.filter((x) => x.sessionId !== id),
        }));
      },
      async saveBodyWeight(b) {
        await write((db) => repo.putBodyWeight(db, b), (d) => ({ ...d, bodyWeightEntries: upsert(d.bodyWeightEntries, b) }));
      },
      async deleteBodyWeight(id) {
        await write((db) => repo.deleteBodyWeight(db, id), (d) => ({ ...d, bodyWeightEntries: d.bodyWeightEntries.filter((b) => b.id !== id) }));
      },
      async saveRoutine(r) {
        const next = { ...r, updatedAt: nowIso() };
        await write((db) => repo.putRoutine(db, next), (d) => ({ ...d, recoveryRoutines: upsert(d.recoveryRoutines, next) }));
      },
      async deleteRoutine(id) {
        await write((db) => repo.deleteRoutine(db, id), (d) => ({ ...d, recoveryRoutines: d.recoveryRoutines.filter((r) => r.id !== id) }));
      },
      async resetRoutine() {
        const r = { ...structuredClone(SEED_RECOVERY), updatedAt: nowIso() };
        await write((db) => repo.putRoutine(db, r), (d) => ({ ...d, recoveryRoutines: upsert(d.recoveryRoutines, r) }));
      },
      async saveRecoveryLog(r) {
        await write((db) => repo.putRecoveryLog(db, r), (d) => ({ ...d, recoveryLogs: upsert(d.recoveryLogs, r) }));
      },
      async attachMedia(exerciseId, file, attribution) {
        if (!MEDIA_TYPES.includes(file.type)) throw new Error('Use a GIF, PNG, JPEG, WebP, MP4, WebM or MOV file.');
        if (file.size > MAX_MEDIA_BYTES) throw new Error('That file is over 15 MB. Use a shorter or smaller clip.');
        const ex = data().exercises.find((e) => e.id === exerciseId);
        if (!ex) throw new Error('Exercise not found');
        const media = {
          id: uid('media'),
          exerciseId,
          blob: file as Blob,
          mimeType: file.type,
          fileName: file.name.slice(0, 200),
          attribution: attribution.slice(0, 300),
          addedAt: nowIso(),
        };
        const oldId = ex.userMediaId;
        const nextEx = { ...ex, userMediaId: media.id, updatedAt: nowIso() };
        await write(
          async (db) => {
            const tx = db.transaction(['media', 'exercises'], 'readwrite');
            await tx.objectStore('media').put(media);
            if (oldId) await tx.objectStore('media').delete(oldId);
            await tx.objectStore('exercises').put(nextEx);
            await tx.done;
          },
          (d) => ({
            ...d,
            exercises: upsert(d.exercises, nextEx),
            mediaIndex: [...d.mediaIndex.filter((m) => m.id !== oldId), { id: media.id, exerciseId, fileName: media.fileName, attribution: media.attribution, mimeType: media.mimeType }],
          }),
        );
      },
      async removeMedia(exerciseId) {
        const ex = data().exercises.find((e) => e.id === exerciseId);
        if (!ex?.userMediaId) return;
        const oldId = ex.userMediaId;
        const nextEx = { ...ex, updatedAt: nowIso() };
        delete nextEx.userMediaId;
        await write(
          async (db) => {
            const tx = db.transaction(['media', 'exercises'], 'readwrite');
            await tx.objectStore('media').delete(oldId);
            await tx.objectStore('exercises').put(nextEx);
            await tx.done;
          },
          (d) => ({ ...d, exercises: upsert(d.exercises, nextEx), mediaIndex: d.mediaIndex.filter((m) => m.id !== oldId) }),
        );
      },
      async getMediaBlob(mediaId) {
        const db = dbRef.current;
        if (!db) return undefined;
        return (await repo.getMedia(db, mediaId))?.blob;
      },
      exportBackup() {
        const d = data();
        return buildBackup({
          workouts: d.workouts,
          exercises: d.exercises,
          sessions: d.sessions,
          setLogs: d.setLogs,
          settings: d.settings,
          recoveryRoutines: d.recoveryRoutines,
          recoveryLogs: d.recoveryLogs,
          bodyWeightEntries: d.bodyWeightEntries,
          mediaReferences: d.mediaIndex.map(({ id, exerciseId, fileName, attribution }) => ({ id, exerciseId, fileName, attribution })),
        });
      },
      async importBackup(b, mode) {
        const db = dbRef.current;
        if (!db) throw new Error('Storage is not ready');
        const localMedia = new Set(data().mediaIndex.map((m) => m.id));
        // Media blobs are not part of backups — detach references to media this device doesn't have.
        const exercises = b.exercises.map((e) => {
          if (e.userMediaId && !localMedia.has(e.userMediaId)) {
            const c = { ...e };
            delete c.userMediaId;
            return c;
          }
          return e;
        });
        let message: string;
        try {
          if (mode === 'replace') {
            await replaceAll(db, { ...b, exercises });
            message = 'Backup restored. This device now matches the backup.';
          } else {
            const r = await mergeIn(db, { ...b, exercises });
            message = `Merged: ${r.added} record${r.added === 1 ? '' : 's'} added, ${r.skipped} already on this device left unchanged.`;
          }
        } catch (e) {
          toast('Import failed. Nothing on this device was changed.', 'error');
          throw e;
        }
        const fresh = await loadAll(db);
        dataRef.current = fresh;
        setState({ kind: 'ready', data: fresh });
        return message;
      },
    };
  }, [toast, write]);

  const value = useMemo<Ctx>(
    () => ({ state, actions, toasts, dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)) }),
    [state, actions, toasts],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}

/** Use only below the "ready" gate in App. */
export function useData(): Snapshot & { actions: Actions } {
  const { state, actions } = useStore();
  if (state.kind !== 'ready') throw new Error('Data not ready');
  return { ...state.data, actions };
}

export function useExerciseLookup() {
  const { exercises } = useData();
  return useMemo(() => {
    const map = new Map(exercises.map((e) => [e.id, e]));
    return (id: string) => map.get(id);
  }, [exercises]);
}
