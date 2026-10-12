/* REP domain types. Weights are always stored in POUNDS and converted for display. */

export type Unit = 'lb' | 'kg';

export type EquipmentId =
  | 'f22-rack'
  | 'cable-left'
  | 'cable-right'
  | 'lat-extender'
  | 'barbell'
  | 'plates'
  | 'ez-bar'
  | 'bench'
  | 'hyperextension'
  | 'leg-machine'
  | 'dumbbells'
  | 'kettlebell-15'
  | 'kettlebell-adjustable'
  | 'cable-attachments'
  | 'microplates'
  | 'floor';

export interface Equipment {
  id: EquipmentId;
  name: string;
  detail?: string;
}

export type Muscle =
  | 'chest'
  | 'upper chest'
  | 'front delts'
  | 'rear delts'
  | 'upper back'
  | 'lats'
  | 'spinal erectors'
  | 'glutes'
  | 'hamstrings'
  | 'quads'
  | 'biceps'
  | 'brachialis'
  | 'triceps'
  | 'core'
  | 'rotator cuff'
  | 'adductors'
  | 'hip flexors';

export type MovementPattern =
  | 'hinge'
  | 'horizontal push'
  | 'incline push'
  | 'horizontal pull'
  | 'vertical pull'
  | 'face pull'
  | 'knee extension'
  | 'knee flexion'
  | 'squat'
  | 'elbow flexion'
  | 'elbow extension'
  | 'core stability';

export type SetupCategory =
  | 'rack'
  | 'cable'
  | 'machine'
  | 'free weight'
  | 'floor'
  | 'hyperextension';

export type CableArmPosition =
  /** Arm lowered into the rack's working area (e.g. seated row on the F22). */
  | 'lowered-into-rack'
  | 'high'
  | 'mid'
  | 'low-outside';

export type CableSide = 'left' | 'right' | 'either';

export type Availability = 'available' | 'restricted' | 'clinician-review';

export type LoadType =
  | 'barbell'
  | 'ez-bar'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'kettlebell'
  | 'bodyweight';

export interface ExerciseSetupRequirements {
  category: SetupCategory;
  /** True when the exercise uses the F22 rack (J-hooks / safeties / barbell in the rack). */
  occupiesRack: boolean;
  cable?: { side: CableSide; arm: CableArmPosition };
  bench?: 'flat' | 'incline' | 'none';
  /** Free-form tags the rules engine can reason about. */
  conflictTags: string[];
}

/** What the user has written down about how *they* set up the exercise. */
export interface UserSetup {
  benchAngle?: string;
  rackHeight?: string;
  cableHeight?: string;
  cableSide?: string;
  attachment?: string;
  grip?: string;
  notes?: string;
}

export interface Exercise {
  id: string;
  name: string;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  movement: MovementPattern;
  loadType: LoadType;
  equipment: { required: EquipmentId[]; optional: EquipmentId[] };
  setup: ExerciseSetupRequirements;
  summary: string;
  cues: string[];
  setupSteps: string[];
  mistakes: string[];
  /** Exercise IDs that can stand in for this one. */
  alternatives: string[];
  availability: Availability;
  caution?: string;
  perSide?: boolean;
  custom: boolean;
  userSetup: UserSetup;
  userNotes: string;
  /** ID of a user-attached media record (stored in IndexedDB), if any. */
  userMediaId?: string;
  updatedAt: string;
}

export type LoadKind = 'historical' | 'suggested' | 'bodyweight' | 'unset';

export interface Prescription {
  repsMin: number;
  repsMax: number;
  perSide: boolean;
  /** Sets performed each round. In 3×3×3 this is 1 (three rounds → three sets). */
  setsPerRound: number;
  /** Load in pounds, or null for bodyweight / not yet set. */
  loadLb: number | null;
  loadKind: LoadKind;
  restNote?: string;
  notes?: string;
}

export interface Slot {
  id: string;
  exerciseId: string;
  prescription: Prescription;
}

export interface Block {
  id: string;
  name: string;
  rounds: number;
  slots: Slot[];
}

export interface WorkoutTemplate {
  id: string;
  code: string;
  name: string;
  focus: string;
  blocks: Block[];
  /** True for seeded templates that can be reset to original defaults. */
  seeded: boolean;
  version: number;
  /** Planned minutes per round, used only for estimates — never enforced. */
  minutesPerRound: number;
  createdAt: string;
  updatedAt: string;
}

export type EntryStatus = 'pending' | 'done' | 'skipped';

export interface EntryState {
  status: EntryStatus;
  via?: 'sets' | 'quick' | 'quick-unlogged';
  at?: string;
}

export interface Cursor {
  block: number;
  round: number;
  slot: number;
}

export type SessionStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface Session {
  id: string;
  workoutId: string;
  workoutCode: string;
  workoutName: string;
  /** Frozen copy of the template at the moment the session started. */
  snapshot: WorkoutTemplate;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  pausedAt?: string;
  pausedMs: number;
  cursor: Cursor;
  /** Keyed by entryKey(blockIndex, round, slotId). */
  entries: Record<string, EntryState>;
  /** slotId → substituted exercise ID for this session only. */
  substitutions: Record<string, string>;
  notes: string;
  updatedAt: string;
}

export type SetSource = 'logged' | 'prescribed-confirmed' | 'auto-prescribed';

export interface SetLog {
  id: string;
  sessionId: string;
  slotId: string;
  /** Exercise actually performed (after substitution). */
  exerciseId: string;
  blockIndex: number;
  round: number;
  setIndex: number;
  weightLb: number | null;
  reps: number | null;
  rpe?: number;
  rir?: number;
  note?: string;
  completed: boolean;
  source: SetSource;
  performedAt: string;
  updatedAt: string;
}

export interface BodyWeightEntry {
  id: string;
  date: string;
  weightLb: number;
  note?: string;
}

export interface RecoveryMovement {
  id: string;
  name: string;
  description: string;
  dose: { kind: 'reps' | 'seconds' | 'minutes' | 'breaths'; value: number; perSide?: boolean };
  availability: Availability;
  note?: string;
}

export interface RecoveryRoutine {
  id: string;
  name: string;
  seeded: boolean;
  movements: RecoveryMovement[];
  updatedAt: string;
}

export interface RecoveryLog {
  id: string;
  routineId: string;
  date: string;
  done: string[];
  skipped: string[];
}

export interface Settings {
  unit: Unit;
  /** If true, quick-completing an exercise logs prescribed values without asking. */
  autoLogPrescribed: boolean;
  ownedEquipment: EquipmentId[];
  /** Sorted pairs "exA|exB" of cable exercises the user has confirmed fit together. */
  verifiedCablePairs: string[];
  lastBackupAt?: string;
  installHintDismissed: boolean;
}

export interface UserMedia {
  id: string;
  exerciseId: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
  attribution: string;
  addedAt: string;
}

export interface MediaManifestEntry {
  exerciseId: string;
  assetPath: string | null;
  format: 'mp4' | 'webm' | 'gif' | 'webp' | null;
  attribution: string | null;
  license: string | null;
  sourceUrl: string | null;
  cachePolicy: 'precache' | 'runtime' | 'none';
  fallback: 'movement-diagram';
  verified: boolean;
  status: 'bundled' | 'not-bundled';
  note: string;
}

export interface BackupFile {
  app: 'REP';
  schemaVersion: number;
  exportedAt: string;
  workouts: WorkoutTemplate[];
  /** Custom exercises plus user edits to built-in exercises. */
  exercises: Exercise[];
  sessions: Session[];
  setLogs: SetLog[];
  settings: Settings;
  recoveryRoutines: RecoveryRoutine[];
  recoveryLogs: RecoveryLog[];
  bodyWeightEntries: BodyWeightEntry[];
  /** Metadata only — media files themselves are not included in backups. */
  mediaReferences: { id: string; exerciseId: string; fileName: string; attribution: string }[];
}
