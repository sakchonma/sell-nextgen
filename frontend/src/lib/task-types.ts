import type { ActivityTypeOption } from '../hooks/useActivityTypes';

export const FALLBACK_TASK_TYPES = [
  { code: 'Call', label: 'Call', labelTh: 'โทรออก' },
  { code: 'Meeting', label: 'Meeting', labelTh: 'นัดประชุม' },
  { code: 'Presentation', label: 'Presentation', labelTh: 'นำเสนอ' },
  { code: 'Demo', label: 'Demo', labelTh: 'สาธิต' },
  { code: 'FollowUp', label: 'Follow up', labelTh: 'ติดตามงาน' },
  { code: 'Other', label: 'Other', labelTh: 'อื่นๆ', allowCustomLabel: true },
] as const;

/** @deprecated use useActivityTypes(scope: 'task') */
export const TASK_TYPES = FALLBACK_TASK_TYPES.map(row => ({ value: row.code, label: row.label }));

export type TaskTypeValue = (typeof FALLBACK_TASK_TYPES)[number]['code'];

function resolveType(type?: string, typeLabel?: string, types?: ActivityTypeOption[]) {
  const list = types?.length ? types : FALLBACK_TASK_TYPES.map(row => ({ ...row, _id: row.code, scopes: ['task' as const], sortOrder: 0, isActive: true, isSystem: true }));
  const found = list.find(row => row.code === type);
  if (found?.allowCustomLabel && typeLabel?.trim()) return typeLabel.trim();
  if (type === 'Other' && typeLabel?.trim()) return typeLabel.trim();
  return found?.labelTh || found?.label || type || 'Other';
}

export function formatTaskType(type?: string, typeLabel?: string, types?: ActivityTypeOption[]) {
  return resolveType(type, typeLabel, types);
}

export function activityTypeSelectOptions(types: ActivityTypeOption[]) {
  return types.map(row => ({ value: row.code, label: row.labelTh || row.label }));
}

export function findActivityType(types: ActivityTypeOption[], code?: string) {
  return types.find(row => row.code === code);
}

export function typeAllowsCustomLabel(types: ActivityTypeOption[], code?: string) {
  const found = findActivityType(types, code);
  return Boolean(found?.allowCustomLabel || code === 'Other');
}
