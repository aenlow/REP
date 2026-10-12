import type {
  Availability,
  BackupFile,
  Block,
  BodyWeightEntry,
  EquipmentId,
  Exercise,
  RecoveryLog,
  RecoveryMovement,
  RecoveryRoutine,
  Session,
  SetLog,
  Settings,
  Slot,
  WorkoutTemplate,
} from '../types';
import { ALL_EQUIPMENT_IDS } from '../data/equipment';

export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export interface BackupData {
  workouts: WorkoutTemplate[];
  exercises: Exercise[];
  sessions: Session[];
  setLogs: SetLog[];
  settings: Settings;
  recoveryRoutines: RecoveryRoutine[];
  recoveryLogs: RecoveryLog[];
  bodyWeightEntries: BodyWeightEntry[];
  mediaReferences: BackupFile['mediaReferences'];
}

export function buildBackup(data: BackupData, now = new Date().toISOString()): BackupFile {
  return { app: 'REP', schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now, ...structuredClone(data) };
}

// ——— Validation helpers. Imported data is untrusted: unknown fields are dropped. ———

class ImportError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(o: Obj, k: string, opts: { max?: number; optional?: boolean } = {}): string {
  const v = o[k];
  if (v === undefined || v === null) {
    if (opts.optional) return '';
    throw new ImportError(`Missing text field "${k}".`);
  }
  if (typeof v !== 'string') throw new ImportError(`Field "${k}" should be text.`);
  return v.slice(0, opts.max ?? 2000);
}
function optStr(o: Obj, k: string, max = 2000): string | undefined {
  const v = o[k];
  return typeof v === 'string' && v.length ? v.slice(0, max) : undefined;
}
function num(o: Obj, k: string, opts: { min?: number; max?: number; nullable?: boolean } = {}): number {
  const v = o[k];
  if (v === null && opts.nullable) return null as unknown as number;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ImportError(`Field "${k}" should be a number.`);
  if (opts.min !== undefined && v < opts.min) throw new ImportError(`Field "${k}" is too small.`);
  if (opts.max !== undefined && v > opts.max) throw new ImportError(`Field "${k}" is too large.`);
  return v;
}
function optNum(o: Obj, k: string): number | undefined {
  const v = o[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function bool(o: Obj, k: string, fallback = false): boolean {
  return typeof o[k] === 'boolean' ? (o[k] as boolean) : fallback;
}
function arr(o: Obj, k: string): unknown[] {
  const v = o[k];
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new ImportError(`Field "${k}" should be a list.`);
  return v;
}
function strList(o: Obj, k: string): string[] {
  return arr(o, k).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 500));
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}
const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?([+-]\d{2}:?\d{2})?)?$/;
function date(o: Obj, k: string, optional = false): string {
  const v = o[k];
  if ((v === undefined || v === null) && optional) return '';
  if (typeof v !== 'string' || !ISO.test(v) || Number.isNaN(Date.parse(v))) {
    throw new ImportError(`Field "${k}" should be a date.`);
  }
  return v;
}
function id(o: Obj, k = 'id'): string {
  const v = str(o, k, { max: 120 });
  if (!/^[A-Za-z0-9_.:|-]{1,120}$/.test(v)) throw new ImportError(`Field "${k}" has an invalid identifier.`);
  return v;
}

const AVAIL: readonly Availability[] = ['available', 'restricted', 'clinician-review'];

function slot(o: unknown): Slot {
  if (!isObj(o)) throw new ImportError('A workout exercise entry is malformed.');
  const p = isObj(o.prescription) ? o.prescription : {};
  const loadLb = p.loadLb === null ? null : num(p, 'loadLb', { min: 0, max: 2000 });
  return {
    id: id(o),
    exerciseId: id(o, 'exerciseId'),
    prescription: {
      repsMin: num(p, 'repsMin', { min: 0, max: 100 }),
      repsMax: num(p, 'repsMax', { min: 0, max: 100 }),
      perSide: bool(p, 'perSide'),
      setsPerRound: num(p, 'setsPerRound', { min: 1, max: 10 }),
      loadLb,
      loadKind: oneOf(p.loadKind, ['historical', 'suggested', 'bodyweight', 'unset'] as const, 'unset'),
      ...(optStr(p, 'restNote') ? { restNote: optStr(p, 'restNote')! } : {}),
      ...(optStr(p, 'notes') ? { notes: optStr(p, 'notes')! } : {}),
    },
  };
}

function block(o: unknown): Block {
  if (!isObj(o)) throw new ImportError('A workout block is malformed.');
  return { id: id(o), name: str(o, 'name', { max: 80 }), rounds: num(o, 'rounds', { min: 1, max: 10 }), slots: arr(o, 'slots').map(slot) };
}

function workout(o: unknown): WorkoutTemplate {
  if (!isObj(o)) throw new ImportError('A workout is malformed.');
  return {
    id: id(o),
    code: str(o, 'code', { max: 8 }),
    name: str(o, 'name', { max: 80 }),
    focus: str(o, 'focus', { max: 200, optional: true }),
    blocks: arr(o, 'blocks').map(block),
    seeded: bool(o, 'seeded'),
    version: num(o, 'version', { min: 1 }),
    minutesPerRound: optNum(o, 'minutesPerRound') ?? 5,
    createdAt: date(o, 'createdAt'),
    updatedAt: date(o, 'updatedAt'),
  };
}

function equipmentList(v: unknown): EquipmentId[] {
  return Array.isArray(v) ? v.filter((x): x is EquipmentId => ALL_EQUIPMENT_IDS.includes(x as EquipmentId)) : [];
}

function exercise(o: unknown): Exercise {
  if (!isObj(o)) throw new ImportError('An exercise is malformed.');
  const eq = isObj(o.equipment) ? o.equipment : {};
  const setup = isObj(o.setup) ? o.setup : {};
  const cable = isObj(setup.cable) ? setup.cable : undefined;
  const us = isObj(o.userSetup) ? o.userSetup : {};
  const userSetup: Exercise['userSetup'] = {};
  for (const k of ['benchAngle', 'rackHeight', 'cableHeight', 'cableSide', 'attachment', 'grip', 'notes'] as const) {
    const v = optStr(us, k, 500);
    if (v) userSetup[k] = v;
  }
  return {
    id: id(o),
    name: str(o, 'name', { max: 80 }),
    primaryMuscles: strList(o, 'primaryMuscles') as Exercise['primaryMuscles'],
    secondaryMuscles: strList(o, 'secondaryMuscles') as Exercise['secondaryMuscles'],
    movement: str(o, 'movement', { max: 40 }) as Exercise['movement'],
    loadType: oneOf(o.loadType, ['barbell', 'ez-bar', 'dumbbell', 'cable', 'machine', 'kettlebell', 'bodyweight'] as const, 'bodyweight'),
    equipment: { required: equipmentList(eq.required), optional: equipmentList(eq.optional) },
    setup: {
      category: oneOf(setup.category, ['rack', 'cable', 'machine', 'free weight', 'floor', 'hyperextension'] as const, 'free weight'),
      occupiesRack: bool(setup, 'occupiesRack'),
      bench: oneOf(setup.bench, ['flat', 'incline', 'none'] as const, 'none'),
      conflictTags: strList(setup, 'conflictTags'),
      ...(cable
        ? {
            cable: {
              side: oneOf(cable.side, ['left', 'right', 'either'] as const, 'either'),
              arm: oneOf(cable.arm, ['lowered-into-rack', 'high', 'mid', 'low-outside'] as const, 'high'),
            },
          }
        : {}),
    },
    summary: str(o, 'summary', { max: 500, optional: true }),
    cues: strList(o, 'cues'),
    setupSteps: strList(o, 'setupSteps'),
    mistakes: strList(o, 'mistakes'),
    alternatives: strList(o, 'alternatives'),
    availability: oneOf(o.availability, AVAIL, 'available'),
    ...(optStr(o, 'caution') ? { caution: optStr(o, 'caution')! } : {}),
    perSide: bool(o, 'perSide'),
    custom: bool(o, 'custom'),
    userSetup,
    userNotes: str(o, 'userNotes', { max: 4000, optional: true }),
    ...(optStr(o, 'userMediaId', 120) ? { userMediaId: optStr(o, 'userMediaId', 120)! } : {}),
    updatedAt: date(o, 'updatedAt'),
  };
}

function session(o: unknown): Session {
  if (!isObj(o)) throw new ImportError('A session is malformed.');
  const c = isObj(o.cursor) ? o.cursor : {};
  const entries: Session['entries'] = {};
  if (isObj(o.entries)) {
    for (const [k, v] of Object.entries(o.entries)) {
      if (!/^\d+:\d+:[A-Za-z0-9_.:-]+$/.test(k) || !isObj(v)) continue;
      entries[k] = {
        status: oneOf(v.status, ['pending', 'done', 'skipped'] as const, 'pending'),
        ...(typeof v.via === 'string' ? { via: oneOf(v.via, ['sets', 'quick', 'quick-unlogged'] as const, 'sets') } : {}),
        ...(typeof v.at === 'string' ? { at: v.at.slice(0, 40) } : {}),
      };
    }
  }
  const subs: Record<string, string> = {};
  if (isObj(o.substitutions)) {
    for (const [k, v] of Object.entries(o.substitutions)) if (typeof v === 'string') subs[k.slice(0, 120)] = v.slice(0, 120);
  }
  const status = oneOf(o.status, ['active', 'paused', 'completed', 'abandoned'] as const, 'completed');
  return {
    id: id(o),
    workoutId: id(o, 'workoutId'),
    workoutCode: str(o, 'workoutCode', { max: 8 }),
    workoutName: str(o, 'workoutName', { max: 80 }),
    snapshot: workout(o.snapshot),
    status,
    startedAt: date(o, 'startedAt'),
    ...(o.endedAt ? { endedAt: date(o, 'endedAt') } : {}),
    ...(o.pausedAt ? { pausedAt: date(o, 'pausedAt') } : {}),
    pausedMs: optNum(o, 'pausedMs') ?? 0,
    cursor: { block: optNum(c, 'block') ?? 0, round: optNum(c, 'round') ?? 0, slot: optNum(c, 'slot') ?? 0 },
    entries,
    substitutions: subs,
    notes: str(o, 'notes', { max: 4000, optional: true }),
    updatedAt: date(o, 'updatedAt'),
  };
}

function setLog(o: unknown): SetLog {
  if (!isObj(o)) throw new ImportError('A set record is malformed.');
  return {
    id: id(o),
    sessionId: id(o, 'sessionId'),
    slotId: id(o, 'slotId'),
    exerciseId: id(o, 'exerciseId'),
    blockIndex: num(o, 'blockIndex', { min: 0, max: 50 }),
    round: num(o, 'round', { min: 0, max: 50 }),
    setIndex: num(o, 'setIndex', { min: 0, max: 50 }),
    weightLb: o.weightLb === null ? null : num(o, 'weightLb', { min: 0, max: 2000 }),
    reps: o.reps === null ? null : num(o, 'reps', { min: 0, max: 500 }),
    ...(optNum(o, 'rpe') !== undefined ? { rpe: optNum(o, 'rpe')! } : {}),
    ...(optNum(o, 'rir') !== undefined ? { rir: optNum(o, 'rir')! } : {}),
    ...(optStr(o, 'note', 1000) ? { note: optStr(o, 'note', 1000)! } : {}),
    completed: bool(o, 'completed', true),
    source: oneOf(o.source, ['logged', 'prescribed-confirmed', 'auto-prescribed'] as const, 'logged'),
    performedAt: date(o, 'performedAt'),
    updatedAt: date(o, 'updatedAt'),
  };
}

function movement(o: unknown): RecoveryMovement {
  if (!isObj(o)) throw new ImportError('A recovery movement is malformed.');
  const d = isObj(o.dose) ? o.dose : {};
  return {
    id: id(o),
    name: str(o, 'name', { max: 80 }),
    description: str(o, 'description', { max: 600, optional: true }),
    dose: {
      kind: oneOf(d.kind, ['reps', 'seconds', 'minutes', 'breaths'] as const, 'reps'),
      value: num(d, 'value', { min: 0, max: 999 }),
      ...(bool(d, 'perSide') ? { perSide: true } : {}),
    },
    availability: oneOf(o.availability, AVAIL, 'available'),
    ...(optStr(o, 'note', 200) ? { note: optStr(o, 'note', 200)! } : {}),
  };
}

function routine(o: unknown): RecoveryRoutine {
  if (!isObj(o)) throw new ImportError('A recovery routine is malformed.');
  return { id: id(o), name: str(o, 'name', { max: 80 }), seeded: bool(o, 'seeded'), movements: arr(o, 'movements').map(movement), updatedAt: date(o, 'updatedAt') };
}

function recoveryLog(o: unknown): RecoveryLog {
  if (!isObj(o)) throw new ImportError('A recovery log is malformed.');
  return { id: id(o), routineId: id(o, 'routineId'), date: date(o, 'date'), done: strList(o, 'done'), skipped: strList(o, 'skipped') };
}

function bodyWeight(o: unknown): BodyWeightEntry {
  if (!isObj(o)) throw new ImportError('A body-weight entry is malformed.');
  return {
    id: id(o),
    date: date(o, 'date'),
    weightLb: num(o, 'weightLb', { min: 20, max: 1000 }),
    ...(optStr(o, 'note', 300) ? { note: optStr(o, 'note', 300)! } : {}),
  };
}

function settings(o: unknown, fallback: Settings): Settings {
  if (!isObj(o)) return fallback;
  return {
    unit: oneOf(o.unit, ['lb', 'kg'] as const, fallback.unit),
    autoLogPrescribed: bool(o, 'autoLogPrescribed', fallback.autoLogPrescribed),
    ownedEquipment: Array.isArray(o.ownedEquipment) ? equipmentList(o.ownedEquipment) : fallback.ownedEquipment,
    verifiedCablePairs: strList(o, 'verifiedCablePairs').filter((p) => /^[\w.-]+\|[\w.-]+$/.test(p)),
    ...(optStr(o, 'lastBackupAt', 40) ? { lastBackupAt: optStr(o, 'lastBackupAt', 40)! } : {}),
    installHintDismissed: bool(o, 'installHintDismissed', fallback.installHintDismissed),
  };
}

export interface ImportPreview {
  exportedAt: string;
  schemaVersion: number;
  counts: { workouts: number; exercises: number; sessions: number; setLogs: number; recoveryRoutines: number; bodyWeightEntries: number };
}

export type ParseResult = { ok: true; backup: BackupFile; preview: ImportPreview } | { ok: false; error: string };

export function parseBackup(text: string, defaults: Settings, byteSize = text.length): ParseResult {
  if (byteSize > MAX_IMPORT_BYTES) return { ok: false, error: 'This file is larger than 10 MB, which is too big for a REP backup.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON. Choose a REP backup file (.json).' };
  }
  if (!isObj(raw) || raw.app !== 'REP') return { ok: false, error: 'This file is not a REP backup.' };
  if (typeof raw.schemaVersion !== 'number') return { ok: false, error: 'The backup has no schema version.' };
  if (raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: `This backup was made by a newer version of REP (schema ${raw.schemaVersion}). Update the app, then try again.` };
  }
  try {
    const backup: BackupFile = {
      app: 'REP',
      schemaVersion: raw.schemaVersion,
      exportedAt: date(raw, 'exportedAt'),
      workouts: arr(raw, 'workouts').map(workout),
      exercises: arr(raw, 'exercises').map(exercise),
      sessions: arr(raw, 'sessions').map(session),
      setLogs: arr(raw, 'setLogs').map(setLog),
      settings: settings(raw.settings, defaults),
      recoveryRoutines: arr(raw, 'recoveryRoutines').map(routine),
      recoveryLogs: arr(raw, 'recoveryLogs').map(recoveryLog),
      bodyWeightEntries: arr(raw, 'bodyWeightEntries').map(bodyWeight),
      mediaReferences: arr(raw, 'mediaReferences').filter(isObj).map((m) => ({
        id: str(m, 'id', { max: 120 }),
        exerciseId: str(m, 'exerciseId', { max: 120 }),
        fileName: str(m, 'fileName', { max: 200, optional: true }),
        attribution: str(m, 'attribution', { max: 300, optional: true }),
      })),
    };
    return {
      ok: true,
      backup,
      preview: {
        exportedAt: backup.exportedAt,
        schemaVersion: backup.schemaVersion,
        counts: {
          workouts: backup.workouts.length,
          exercises: backup.exercises.length,
          sessions: backup.sessions.length,
          setLogs: backup.setLogs.length,
          recoveryRoutines: backup.recoveryRoutines.length,
          bodyWeightEntries: backup.bodyWeightEntries.length,
        },
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof ImportError ? `The backup could not be read: ${e.message}` : 'The backup could not be read.' };
  }
}

/** Merge: keep everything already on this device; add records whose IDs are new. */
export function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): { merged: T[]; added: number; skipped: number } {
  const ids = new Set(existing.map((x) => x.id));
  const add = incoming.filter((x) => !ids.has(x.id));
  return { merged: [...existing, ...add], added: add.length, skipped: incoming.length - add.length };
}

// ——— CSV ———

export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  // Neutralise spreadsheet formula injection.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
