import type { Equipment, EquipmentId } from '../types';

export const EQUIPMENT: Equipment[] = [
  { id: 'f22-rack', name: 'Major Fitness F22 rack', detail: 'J-hooks and safeties' },
  { id: 'cable-left', name: 'Cable — left side', detail: 'Dual 2:1 cable system' },
  { id: 'cable-right', name: 'Cable — right side', detail: 'Dual 2:1 cable system' },
  { id: 'lat-extender', name: 'Lat pulldown extender' },
  { id: 'barbell', name: 'Barbell' },
  { id: 'plates', name: 'Barbell plates', detail: 'About 260 lb total' },
  { id: 'ez-bar', name: 'EZ bar' },
  { id: 'bench', name: 'Adjustable bench' },
  { id: 'hyperextension', name: 'Hyperextension machine' },
  { id: 'leg-machine', name: 'RitFit PLC01 leg extension/curl' },
  { id: 'dumbbells', name: 'Adjustable dumbbells', detail: '5–52.5 lb each' },
  { id: 'kettlebell-15', name: 'Kettlebell', detail: '15 lb' },
  { id: 'kettlebell-adjustable', name: 'Adjustable kettlebell', detail: '20–40 lb' },
  { id: 'cable-attachments', name: 'Cable attachments', detail: 'Rope, bars, handles' },
  { id: 'microplates', name: 'Microplates' },
  { id: 'floor', name: 'Mat or floor space' },
];

export const ALL_EQUIPMENT_IDS: EquipmentId[] = EQUIPMENT.map((e) => e.id);

export function equipmentName(id: EquipmentId): string {
  return EQUIPMENT.find((e) => e.id === id)?.name ?? id;
}

/** Equipment the user listed in the brief. Everything is owned by default. */
export const DEFAULT_OWNED_EQUIPMENT: EquipmentId[] = [...ALL_EQUIPMENT_IDS];
