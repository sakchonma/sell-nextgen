import { DEFAULT_ACTIVITY_TYPES } from '../config/activity-type-defaults.js';
import { ActivityTypes } from '../models/db.js';
import type { ActivityTypeConfig, ActivityTypeScope } from '../types/index.js';

async function findAllActivityTypes() {
  const coll = ActivityTypes();
  const result = await coll.find({});
  const docs = Array.isArray(result) ? result : await (result as any).toArray();
  return Array.isArray(docs) ? docs : [];
}

export async function ensureActivityTypesSeeded() {
  const existing = await findAllActivityTypes();
  if (existing.length > 0) return existing;

  for (const item of DEFAULT_ACTIVITY_TYPES) {
    await (ActivityTypes() as any).insertOne({
      _id: `at_${item.code.toLowerCase()}`,
      ...item,
    });
  }
  return findAllActivityTypes();
}

export async function listActivityTypes(scope?: ActivityTypeScope) {
  const rows = await ensureActivityTypesSeeded();
  const filtered = scope
    ? rows.filter(row => row.isActive && row.scopes.includes(scope))
    : rows;
  return filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'th'));
}

export async function getActiveTypeCodes(scope: ActivityTypeScope) {
  const rows = await listActivityTypes(scope);
  return rows.map(row => row.code);
}

export async function isValidActivityType(code: string, scope: ActivityTypeScope) {
  if (!code?.trim()) return false;
  const rows = await listActivityTypes(scope);
  return rows.some(row => row.code === code);
}

export async function findActivityTypeByCode(code: string) {
  const rows = await ensureActivityTypesSeeded();
  return rows.find(row => row.code === code) || null;
}

export function formatActivityTypeLabel(type?: string, typeLabel?: string, rows?: ActivityTypeConfig[]) {
  if (!type) return 'Other';
  const found = rows?.find(row => row.code === type);
  if (found?.allowCustomLabel && typeLabel?.trim()) return typeLabel.trim();
  return found?.labelTh || found?.label || typeLabel?.trim() || type;
}

export async function createActivityType(input: {
  code: string;
  label: string;
  labelTh?: string;
  scopes: ActivityTypeScope[];
  sortOrder?: number;
  allowCustomLabel?: boolean;
}) {
  const code = input.code.trim();
  if (!/^[A-Za-z][A-Za-z0-9_]{1,39}$/.test(code)) {
    throw new Error('รหัสประเภทต้องเป็นภาษาอังกฤษ ขึ้นต้นด้วยตัวอักษร และไม่มีช่องว่าง');
  }
  const existing = await findActivityTypeByCode(code);
  if (existing) throw new Error('รหัสประเภทกิจกรรมนี้มีอยู่แล้ว');

  const now = new Date();
  const doc: ActivityTypeConfig = {
    _id: `at_${code.toLowerCase()}_${Date.now()}`,
    code,
    label: input.label.trim(),
    labelTh: input.labelTh?.trim() || input.label.trim(),
    scopes: input.scopes.length ? input.scopes : ['task'],
    sortOrder: Number(input.sortOrder ?? 50),
    isActive: true,
    isSystem: false,
    allowCustomLabel: Boolean(input.allowCustomLabel),
    createdAt: now,
    updatedAt: now,
  };
  await (ActivityTypes() as any).insertOne(doc);
  return doc;
}

export async function updateActivityType(id: string, patch: Partial<ActivityTypeConfig>) {
  const rows = await ensureActivityTypesSeeded();
  const current = rows.find(row => row._id === id);
  if (!current) throw new Error('ไม่พบประเภทกิจกรรม');

  const next: ActivityTypeConfig = {
    ...current,
    ...patch,
    _id: current._id,
    code: current.isSystem ? current.code : (patch.code || current.code),
    isSystem: current.isSystem,
    updatedAt: new Date(),
  };
  await (ActivityTypes() as any).updateOne({ _id: id }, { $set: next });
  return next;
}

export async function deactivateActivityType(id: string) {
  const rows = await ensureActivityTypesSeeded();
  const current = rows.find(row => row._id === id);
  if (!current) throw new Error('ไม่พบประเภทกิจกรรม');
  if (current.isSystem) {
    return updateActivityType(id, { isActive: false });
  }
  await (ActivityTypes() as any).deleteOne({ _id: id });
  return { deleted: true };
}
