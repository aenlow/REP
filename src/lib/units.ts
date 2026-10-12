import type { Unit } from '../types';

export const LB_PER_KG = 2.20462262185;

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

function round(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** Convert a stored pound value to the display unit, rounded sensibly. */
export function toDisplay(lb: number, unit: Unit): number {
  if (unit === 'lb') return round(lb, 0.25);
  return round(lbToKg(lb), 0.1);
}

/** Convert a value entered in the display unit back to stored pounds. */
export function fromDisplay(value: number, unit: Unit): number {
  const lb = unit === 'lb' ? value : kgToLb(value);
  return Math.round(lb * 1000) / 1000;
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatWeight(lb: number | null | undefined, unit: Unit): string {
  if (lb === null || lb === undefined) return '—';
  return `${formatNumber(toDisplay(lb, unit))} ${unit}`;
}

/** Step used by the +/- weight controls, in the display unit. */
export function weightStep(unit: Unit, loadType?: string): number {
  if (unit === 'kg') return loadType === 'dumbbell' ? 1 : 1.25;
  if (loadType === 'dumbbell') return 2.5;
  if (loadType === 'machine' || loadType === 'cable') return 5;
  return 5;
}
