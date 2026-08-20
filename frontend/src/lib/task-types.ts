export const TASK_TYPES = [
  { value: 'Call', label: 'Call' },
  { value: 'Meeting', label: 'Meeting' },
  { value: 'Presentation', label: 'Presentation' },
  { value: 'Demo', label: 'Demo' },
  { value: 'FollowUp', label: 'Follow up' },
  { value: 'Other', label: 'Other' },
] as const;

export type TaskTypeValue = (typeof TASK_TYPES)[number]['value'];

export function formatTaskType(type?: string, typeLabel?: string) {
  if (type === 'Other' && typeLabel?.trim()) return typeLabel.trim();
  const found = TASK_TYPES.find(t => t.value === type);
  return found?.label || type || 'Other';
}
