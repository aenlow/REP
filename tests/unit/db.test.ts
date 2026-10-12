import { describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import { DB_VERSION, loadAll, mergeIn, openRepDb, replaceAll, repo, seed } from '../../src/db/db';
import { createSession, makeSet } from '../../src/lib/session';
import { A, dbName } from '../helpers';

describe('IndexedDB schema and seeding', () => {
  it('creates all stores and seeds A, B, exercises, recovery and settings', async () => {
    const db = await openRepDb(dbName());
    expect([...db.objectStoreNames].sort()).toEqual(
      ['appMetadata', 'bodyWeightEntries', 'exercises', 'media', 'recoveryLogs', 'recoveryRoutines', 'sessions', 'setLogs', 'settings', 'workouts'].sort(),
    );
    const d = await loadAll(db);
    expect(d.workouts.map((w) => w.code).sort()).toEqual(['A', 'B']);
    expect(d.exercises.length).toBeGreaterThanOrEqual(20);
    expect(d.recoveryRoutines[0]!.movements).toHaveLength(10);
    expect(d.settings.unit).toBe('lb');
    expect(d.sessions).toEqual([]); // no fake history
    expect((await db.get('appMetadata', 'schemaVersion'))?.value).toBe(DB_VERSION);
    db.close();
  });

  it('reseeding never overwrites user edits or resurrects deleted workouts', async () => {
    const name = dbName();
    const db = await openRepDb(name);
    const a = (await db.get('workouts', 'workout-a'))!;
    a.blocks[0]!.slots[1]!.prescription.loadLb = 85;
    await repo.putWorkout(db, a);
    await repo.deleteWorkout(db, 'workout-b');
    await seed(db);
    expect((await db.get('workouts', 'workout-a'))!.blocks[0]!.slots[1]!.prescription.loadLb).toBe(85);
    expect(await db.get('workouts', 'workout-b')).toBeUndefined();
    db.close();
  });

  it('runs every migration in order from a fresh install and reopening keeps user data', async () => {
    const name = dbName();
    const db = await openRepDb(name);
    expect(db.version).toBe(DB_VERSION);
    const s = createSession(A());
    await repo.putSession(db, s);
    db.close();
    const again = await openRepDb(name);
    expect((await loadAll(again)).sessions.map((x) => x.id)).toEqual([s.id]);
    again.close();
  });

  it('migration table covers every version up to the current one', async () => {
    const { MIGRATIONS } = await import('../../src/db/db');
    for (let v = 1; v <= DB_VERSION; v++) expect(typeof MIGRATIONS[v]).toBe('function');
    // Opening with raw idb at the current version sees the same stores REP created.
    const name = dbName();
    (await openRepDb(name)).close();
    const raw = await openDB(name, DB_VERSION);
    expect(raw.objectStoreNames.contains('setLogs')).toBe(true);
    raw.close();
  });

  it('saves a session and its sets atomically, and deletes them together', async () => {
    const db = await openRepDb(dbName());
    const s = createSession(A());
    const set = makeSet(s, s.cursor, 0, { weightLb: 0, reps: 12 });
    await repo.saveSessionAndSets(db, s, [set]);
    expect(await db.getAllFromIndex('setLogs', 'bySession', s.id)).toHaveLength(1);
    await repo.deleteSession(db, s.id);
    expect(await db.get('sessions', s.id)).toBeUndefined();
    expect(await db.getAllFromIndex('setLogs', 'bySession', s.id)).toHaveLength(0);
    db.close();
  });

  it('merge adds only new IDs; replace mirrors the backup', async () => {
    const db = await openRepDb(dbName());
    const before = await loadAll(db);
    const s = createSession(A());
    const r = await mergeIn(db, { ...before, sessions: [s], setLogs: [], bodyWeightEntries: [], recoveryLogs: [] });
    expect(r.added).toBe(1);
    expect(r.skipped).toBe(before.workouts.length + before.exercises.length + before.recoveryRoutines.length);
    await replaceAll(db, { ...before, workouts: [before.workouts[0]!], sessions: [] });
    const after = await loadAll(db);
    expect(after.workouts).toHaveLength(1);
    expect(after.sessions).toHaveLength(0);
    db.close();
  });
});
