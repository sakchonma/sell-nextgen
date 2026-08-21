import type { ActivityTypeConfig } from '../types/index.js';

const now = new Date();

export const DEFAULT_ACTIVITY_TYPES: Omit<ActivityTypeConfig, '_id'>[] = [
  { code: 'Call', label: 'Call', labelTh: 'โทรออก', scopes: ['task', 'log', 'note'], sortOrder: 1, isActive: true, isSystem: true, allowCustomLabel: false, createdAt: now, updatedAt: now },
  { code: 'Meeting', label: 'Meeting', labelTh: 'นัดประชุม', scopes: ['task', 'log', 'note'], sortOrder: 2, isActive: true, isSystem: true, allowCustomLabel: false, createdAt: now, updatedAt: now },
  { code: 'Presentation', label: 'Presentation', labelTh: 'นำเสนอ', scopes: ['task'], sortOrder: 3, isActive: true, isSystem: true, allowCustomLabel: false, createdAt: now, updatedAt: now },
  { code: 'Demo', label: 'Demo', labelTh: 'สาธิต', scopes: ['task'], sortOrder: 4, isActive: true, isSystem: true, allowCustomLabel: false, createdAt: now, updatedAt: now },
  { code: 'FollowUp', label: 'Follow up', labelTh: 'ติดตามงาน', scopes: ['task', 'log', 'note'], sortOrder: 5, isActive: true, isSystem: true, allowCustomLabel: false, createdAt: now, updatedAt: now },
  { code: 'Email', label: 'Email', labelTh: 'อีเมล', scopes: ['log', 'note'], sortOrder: 6, isActive: true, isSystem: true, allowCustomLabel: false, createdAt: now, updatedAt: now },
  { code: 'General', label: 'General', labelTh: 'ทั่วไป', scopes: ['note'], sortOrder: 7, isActive: true, isSystem: true, allowCustomLabel: false, createdAt: now, updatedAt: now },
  { code: 'Coaching', label: 'Coaching', labelTh: 'Coaching', scopes: ['note'], sortOrder: 8, isActive: true, isSystem: true, allowCustomLabel: false, createdAt: now, updatedAt: now },
  { code: 'Other', label: 'Other', labelTh: 'อื่นๆ', scopes: ['task'], sortOrder: 99, isActive: true, isSystem: true, allowCustomLabel: true, createdAt: now, updatedAt: now },
];
