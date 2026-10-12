import { describe, expect, it } from 'vitest';
import { A, B, exercises, settings } from '../helpers';
import { BACKUP_SCHEMA_VERSION, buildBackup, csvCell, MAX_IMPORT_BYTES, mergeById, parseBackup, toCsv } from '../../src/lib/backup';
import { createSession, finish, makeSet } from '../../src/lib/session';
import { SEED_RECOVERY } from '../../src/data/recovery';
import { resolveLocalAsset, MEDIA_MANIFEST } from '../../src/data/media';
import { sessionsCsv, setsCsv } from '../../src/lib/csv-export';

function sample() {
  let s = createSession(A(), '2026-10-01T15:00:00.000Z');
  const set = makeSet(s, s.cursor, 0, { weightLb: 0, reps: 15, note: '<img src=x onerror=alert(1)>' });
  s = finish({ ...s, notes: 'Felt good' }, '2026-10-01T15:45:00.000Z');
  return buildBackup(
    {
      workouts: [A(), B()],
      exercises,
      sessions: [s],
      setLogs: [set],
      settings: settings(),
      recoveryRoutines: [structuredClone(SEED_RECOVERY)],
      recoveryLogs: [],
      bodyWeightEntries: [{ id: 'bw-1', date: '2026-10-01T07:00:00.000Z', weightLb: 180 }],
      mediaReferences: [],
    },
    '2026-10-12T00:00:00.000Z',
  );
}

describe('backup export', () => {
  it('contains every required section and the schema version', () => {
    const b = sample();
    expect(b).toMatchObject({ app: 'REP', schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: '2026-10-12T00:00:00.000Z' });
    for (const k of ['workouts', 'exercises', 'sessions', 'setLogs', 'settings', 'recoveryRoutines', 'recoveryLogs', 'bodyWeightEntries', 'mediaReferences']) {
      expect(b).toHaveProperty(k);
    }
  });
});

describe('backup import validation', () => {
  it('round-trips', () => {
    const b = sample();
    const r = parseBackup(JSON.stringify(b), settings());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.counts).toEqual({ workouts: 2, exercises: exercises.length, sessions: 1, setLogs: 1, recoveryRoutines: 1, bodyWeightEntries: 1 });
    expect(r.backup.sessions[0]!.notes).toBe('Felt good');
    expect(r.backup.workouts[0]!.blocks[0]!.slots[1]!.prescription.loadLb).toBe(75);
  });

  it('keeps note text as text (never markup)', () => {
    const r = parseBackup(JSON.stringify(sample()), settings());
    expect(r.ok && r.backup.setLogs[0]!.note).toBe('<img src=x onerror=alert(1)>');
  });

  it('rejects non-JSON, non-REP, newer schema and oversize files', () => {
    expect(parseBackup('nope', settings())).toMatchObject({ ok: false, error: expect.stringMatching(/not valid JSON/) });
    expect(parseBackup('{"app":"Other"}', settings())).toMatchObject({ ok: false, error: expect.stringMatching(/not a REP backup/) });
    expect(parseBackup(JSON.stringify({ ...sample(), schemaVersion: 99 }), settings())).toMatchObject({ ok: false, error: expect.stringMatching(/newer version/) });
    expect(parseBackup('{}', settings(), MAX_IMPORT_BYTES + 1)).toMatchObject({ ok: false, error: expect.stringMatching(/10 MB/) });
  });

  it('rejects missing required fields with a readable message', () => {
    const b = sample() as unknown as { sessions: Record<string, unknown>[] };
    delete b.sessions[0]!.startedAt;
    const r = parseBackup(JSON.stringify(b), settings());
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/startedAt/) });
  });

  it('rejects unsafe identifiers', () => {
    const b = sample() as unknown as { workouts: Record<string, unknown>[] };
    b.workouts[0]!.id = '../../etc"><script>';
    expect(parseBackup(JSON.stringify(b), settings()).ok).toBe(false);
  });

  it('drops unknown fields and clamps unknown enums', () => {
    const b = sample() as unknown as Record<string, unknown> & { exercises: Record<string, unknown>[] };
    b.evil = { run: 'code' };
    b.exercises[0]!.__proto__hack = 1;
    b.exercises[0]!.availability = 'whatever';
    const r = parseBackup(JSON.stringify(b), settings());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup).not.toHaveProperty('evil');
    expect(r.backup.exercises[0]).not.toHaveProperty('__proto__hack');
    expect(r.backup.exercises[0]!.availability).toBe('available');
  });
});

describe('merge and CSV', () => {
  it('merge keeps existing records and adds new ones', () => {
    const r = mergeById([{ id: 'a', v: 1 }], [{ id: 'a', v: 2 }, { id: 'b', v: 3 }]);
    expect(r.merged).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 3 }]);
    expect(r).toMatchObject({ added: 1, skipped: 1 });
  });

  it('escapes CSV and neutralises formula injection', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(-5)).toBe('-5');
    expect(toCsv([['a', 1], ['b', null]])).toBe('a,1\r\nb,\r\n');
  });

  it('exports sessions and sets CSV with headers', () => {
    const b = sample();
    const sc = sessionsCsv(b.sessions, b.setLogs).split('\r\n');
    expect(sc[0]).toMatch(/^session_id,workout,status/);
    expect(sc[1]).toMatch(/Workout A,completed/);
    const st = setsCsv(b.sessions, b.setLogs, exercises, 'lb').split('\r\n');
    expect(st[0]).toMatch(/weight_lb,reps/);
    expect(st[1]).toMatch(/Hyperextensions/);
  });
});

describe('media asset resolution', () => {
  it('only resolves safe paths inside media/', () => {
    expect(resolveLocalAsset('media/leg-curl.webm')).toBe('./media/leg-curl.webm');
    for (const bad of ['../secret.mp4', 'media/../../x.gif', '/media/a.gif', 'https://evil.test/a.gif', 'media/a.gif?x=1', 'media/a.svg', 'javascript:alert(1)', null, 42]) {
      expect(resolveLocalAsset(bad)).toBeNull();
    }
  });

  it('manifest honestly reports no bundled media', () => {
    expect(MEDIA_MANIFEST.length).toBe(exercises.length);
    expect(MEDIA_MANIFEST.every((m) => m.status === 'not-bundled' && !m.verified && m.assetPath === null)).toBe(true);
  });
});
