import type { Block, EquipmentId, Exercise, Settings } from '../types';

/**
 * Deterministic equipment rules engine.
 *
 * In a 3×3×3 block the three exercises are performed back-to-back for three
 * rounds, so their setups must coexist. Each rule inspects the exercises in a
 * block and reports issues with one of three severities:
 *
 *  - 'blocked'  The setups physically interfere. Cannot be overridden; the
 *               user must change the block or edit the exercise's equipment
 *               constraints (e.g. if they re-rig the cable).
 *  - 'confirm'  The pairing might work, but REP doesn't know enough. The user
 *               can confirm they've checked it — that confirmation is the
 *               missing information, and is remembered.
 *  - 'notice'   Feasible, but the user will have to change setup between
 *               exercises every round.
 */

export type ConflictSeverity = 'blocked' | 'confirm' | 'notice';

export interface Conflict {
  rule: string;
  severity: ConflictSeverity;
  exerciseIds: string[];
  message: string;
  /** For 'confirm' conflicts, the key the user's confirmation is stored under. */
  pairKey?: string;
}

type Lookup = (id: string) => Exercise | undefined;

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function isCable(e: Exercise): boolean {
  return e.setup.category === 'cable' && !!e.setup.cable;
}

export function checkExerciseSet(
  exercises: Exercise[],
  settings: Pick<Settings, 'verifiedCablePairs'>,
): Conflict[] {
  const out: Conflict[] = [];

  // Rule 1 — F22: a cable arm lowered into the rack's working area blocks barbell work in the rack.
  const rackUsers = exercises.filter((e) => e.setup.occupiesRack);
  const lowered = exercises.filter((e) => e.setup.cable?.arm === 'lowered-into-rack');
  for (const r of rackUsers) {
    for (const c of lowered) {
      if (r.id === c.id) continue;
      out.push({
        rule: 'f22-rack-cable-lowered',
        severity: 'blocked',
        exerciseIds: [r.id, c.id],
        message: `${c.name} needs the cable arm lowered into the rack, which gets in the way of the barbell setup for ${r.name}. Put them in different blocks, or update ${c.name}'s cable setup if you rig it differently.`,
      });
    }
  }

  // Rule 2 — cable sides. The dual system has two sides.
  const cables = exercises.filter(isCable);
  const fixedLeft = cables.filter((e) => e.setup.cable!.side === 'left');
  const fixedRight = cables.filter((e) => e.setup.cable!.side === 'right');
  for (const group of [fixedLeft, fixedRight]) {
    if (group.length > 1) {
      out.push({
        rule: 'cable-same-side',
        severity: 'notice',
        exerciseIds: group.map((e) => e.id),
        message: `${group.map((e) => e.name).join(' and ')} use the same cable side, so you'll change attachment and height every round.`,
      });
    }
  }
  if (cables.length > 2) {
    out.push({
      rule: 'cable-sides-exhausted',
      severity: 'notice',
      exerciseIds: cables.map((e) => e.id),
      message: `${cables.length} cable exercises share two cable sides, so at least one will need re-rigging every round.`,
    });
  } else if (cables.length === 2) {
    const [a, b] = cables as [Exercise, Exercise];
    const sameFixedSide = a.setup.cable!.side !== 'either' && a.setup.cable!.side === b.setup.cable!.side;
    if (!sameFixedSide) {
      const key = pairKey(a.id, b.id);
      if (!settings.verifiedCablePairs.includes(key)) {
        out.push({
          rule: 'cable-pair-unverified',
          severity: 'confirm',
          exerciseIds: [a.id, b.id],
          pairKey: key,
          message: `${a.name} and ${b.name} can run on opposite cable sides only if the attachments and clearance actually fit. Confirm once you've checked your setup.`,
        });
      }
    }
  }

  // Rule 3 — two rack barbell exercises in one block need re-racking every round.
  if (rackUsers.length > 1) {
    out.push({
      rule: 'rack-shared',
      severity: 'notice',
      exerciseIds: rackUsers.map((e) => e.id),
      message: `${rackUsers.map((e) => e.name).join(' and ')} both use the rack; you'll reset the bar and bench each round.`,
    });
  }

  // Rule 4 — bench needed at two different positions.
  const benchPositions = new Set(
    exercises.map((e) => e.setup.bench).filter((b): b is 'flat' | 'incline' => b === 'flat' || b === 'incline'),
  );
  if (benchPositions.size > 1) {
    out.push({
      rule: 'bench-angle-change',
      severity: 'notice',
      exerciseIds: exercises.filter((e) => e.setup.bench === 'flat' || e.setup.bench === 'incline').map((e) => e.id),
      message: 'This block needs the bench flat and inclined, so you will adjust it every round.',
    });
  }

  return out;
}

export function checkBlock(
  block: Block,
  lookup: Lookup,
  settings: Pick<Settings, 'verifiedCablePairs'>,
  substitutions: Record<string, string> = {},
): Conflict[] {
  const exercises = block.slots
    .map((s) => lookup(substitutions[s.id] ?? s.exerciseId))
    .filter((e): e is Exercise => !!e);
  return checkExerciseSet(exercises, settings);
}

export function hasBlocking(conflicts: Conflict[]): boolean {
  return conflicts.some((c) => c.severity === 'blocked');
}

export function missingEquipment(exercise: Exercise, owned: EquipmentId[]): EquipmentId[] {
  const missing = exercise.equipment.required.filter((id) => !owned.includes(id));
  if (isCable(exercise) && !owned.includes('cable-left') && !owned.includes('cable-right')) {
    missing.push('cable-left');
  }
  return missing;
}

export interface SubstituteOption {
  exercise: Exercise;
  /** Why it cannot be chosen, if anything. */
  blockedReason?: string;
  conflicts: Conflict[];
}

/**
 * Candidate substitutes for a slot: listed alternatives first, then exercises
 * with the same movement pattern. Never offers a pairing that creates a
 * 'blocked' conflict — those are returned with a reason and must not be selectable.
 */
export function substituteOptions(
  block: Block,
  slotId: string,
  all: Exercise[],
  settings: Pick<Settings, 'verifiedCablePairs' | 'ownedEquipment'>,
  substitutions: Record<string, string> = {},
): SubstituteOption[] {
  const slot = block.slots.find((s) => s.id === slotId);
  if (!slot) return [];
  const lookup: Lookup = (id) => all.find((e) => e.id === id);
  const current = lookup(substitutions[slotId] ?? slot.exerciseId);
  const original = lookup(slot.exerciseId);
  if (!original) return [];

  const inBlock = new Set(block.slots.map((s) => substitutions[s.id] ?? s.exerciseId));
  const listed = new Set([...original.alternatives, ...(current?.alternatives ?? [])]);
  const candidates = all.filter(
    (e) =>
      e.id !== current?.id &&
      !inBlock.has(e.id) &&
      (listed.has(e.id) || e.movement === original.movement || e.id === original.id),
  );

  const options = candidates.map<SubstituteOption>((candidate) => {
    const conflicts = checkBlock(block, lookup, settings, { ...substitutions, [slotId]: candidate.id });
    const missing = missingEquipment(candidate, settings.ownedEquipment);
    let blockedReason: string | undefined;
    if (hasBlocking(conflicts)) blockedReason = conflicts.find((c) => c.severity === 'blocked')!.message;
    else if (missing.length) blockedReason = 'Needs equipment you have marked as unavailable.';
    else if (candidate.availability === 'restricted') blockedReason = 'You marked this temporarily restricted.';
    return { exercise: candidate, conflicts, ...(blockedReason ? { blockedReason } : {}) };
  });

  const rank = (o: SubstituteOption) =>
    (o.blockedReason ? 100 : 0) +
    (o.exercise.id === original.id ? -10 : 0) +
    (listed.has(o.exercise.id) ? 0 : 10) +
    (o.exercise.movement === original.movement ? 0 : 5);
  return options.sort((a, b) => rank(a) - rank(b) || a.exercise.name.localeCompare(b.exercise.name));
}
