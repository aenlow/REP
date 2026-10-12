import type { Exercise, Settings, WorkoutTemplate } from '../types';
import { checkBlock, type Conflict } from './conflicts';

export interface StructureIssue {
  level: 'error' | 'warning';
  message: string;
}

/** Checks the 3×3×3 shape: 3 blocks × 3 exercises × 3 rounds. Deviations are warnings, not errors. */
export function validateStructure(w: WorkoutTemplate): StructureIssue[] {
  const issues: StructureIssue[] = [];
  if (w.blocks.length !== 3) {
    issues.push({ level: 'warning', message: `Has ${w.blocks.length} block${w.blocks.length === 1 ? '' : 's'}; 3×3×3 uses 3.` });
  }
  w.blocks.forEach((b, i) => {
    if (b.slots.length !== 3) {
      issues.push({ level: 'warning', message: `Block ${i + 1} has ${b.slots.length} exercise${b.slots.length === 1 ? '' : 's'}; 3×3×3 uses 3.` });
    }
    if (b.rounds !== 3) {
      issues.push({ level: 'warning', message: `Block ${i + 1} has ${b.rounds} round${b.rounds === 1 ? '' : 's'}; 3×3×3 uses 3.` });
    }
  });
  return issues;
}

export function isThreeByThreeByThree(w: WorkoutTemplate): boolean {
  return validateStructure(w).length === 0;
}

/** Hard validation used before saving a template. */
export function validateTemplate(
  w: WorkoutTemplate,
  exercises: Exercise[],
): StructureIssue[] {
  const issues: StructureIssue[] = [];
  if (!w.name.trim()) issues.push({ level: 'error', message: 'Give the workout a name.' });
  if (w.blocks.length === 0) issues.push({ level: 'error', message: 'Add at least one block.' });
  const ids = new Set(exercises.map((e) => e.id));
  w.blocks.forEach((b, bi) => {
    if (b.rounds < 1 || b.rounds > 10) issues.push({ level: 'error', message: `Block ${bi + 1}: rounds must be 1–10.` });
    b.slots.forEach((s) => {
      const p = s.prescription;
      if (!ids.has(s.exerciseId)) issues.push({ level: 'error', message: `Block ${bi + 1}: an exercise no longer exists.` });
      if (!(p.repsMin >= 1 && p.repsMax >= p.repsMin && p.repsMax <= 100)) {
        issues.push({ level: 'error', message: `Block ${bi + 1}: reps must be a range like 8–12.` });
      }
      if (p.setsPerRound < 1 || p.setsPerRound > 6) issues.push({ level: 'error', message: `Block ${bi + 1}: sets per round must be 1–6.` });
      if (p.loadLb !== null && !(p.loadLb >= 0 && p.loadLb < 2000)) {
        issues.push({ level: 'error', message: `Block ${bi + 1}: weight looks invalid.` });
      }
    });
  });
  return [...issues, ...validateStructure(w)];
}

export function templateConflicts(
  w: WorkoutTemplate,
  exercises: Exercise[],
  settings: Pick<Settings, 'verifiedCablePairs'>,
): { blockIndex: number; conflicts: Conflict[] }[] {
  const lookup = (id: string) => exercises.find((e) => e.id === id);
  return w.blocks.map((b, blockIndex) => ({ blockIndex, conflicts: checkBlock(b, lookup, settings) }));
}

export function estimatedMinutes(w: WorkoutTemplate): number {
  return w.blocks.reduce((sum, b) => sum + b.rounds * w.minutesPerRound, 0);
}
