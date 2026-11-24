/**
 * Pure helpers for importing Corporate / University leads from data/segment-leads.json
 * (generated from "Nextgen_Corporate_Sales_Launch.xlsx" and
 * "Nextgen_Faculty_Orientation_Research_*.xlsx").
 */
import type { Lead, LeadSegment } from '../types/index.js';
import { normalizeLeadStage, type SalesFunnelStage } from '../config/sales-funnel-stages.js';
import { scoreFromStage, statusFromStage } from './lead-import.js';

export interface SegmentImportContact {
  name: string;
  position?: string;
  phone?: string;
  email?: string;
}

export interface SegmentImportRecord {
  externalRef: string;
  segment: Exclude<LeadSegment, 'school'>;
  name: string;
  province?: string;
  zone?: string;
  stage?: string;
  lastContactedAt?: string;
  nextCallAt?: string;
  campaign?: string;
  contacts?: SegmentImportContact[];
  profile: Record<string, unknown>;
}

export interface SegmentImportFile {
  generatedFrom?: Record<string, string>;
  records: SegmentImportRecord[];
}

const PHONE_RE = /^[0-9+\-\s()]{6,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Same rules as the API's leadContactSchema, so contacts stay editable in the UI. */
export function sanitizeContact(contact: SegmentImportContact) {
  const name = String(contact.name || '').trim();
  if (!name) return null;
  const phone = contact.phone && PHONE_RE.test(contact.phone.trim()) ? contact.phone.trim() : '';
  const email = contact.email && EMAIL_RE.test(contact.email.trim()) ? contact.email.trim() : undefined;
  return {
    name,
    position: String(contact.position || '').trim(),
    phone,
    ...(email ? { email } : {}),
  };
}

export function validateRecord(record: SegmentImportRecord): string[] {
  const problems: string[] = [];
  if (!record.externalRef?.includes(':')) problems.push('externalRef ไม่ถูกต้อง');
  if (record.segment !== 'corporate' && record.segment !== 'university') problems.push(`segment ไม่รองรับ: ${record.segment}`);
  if (!String(record.name || '').trim()) problems.push('ไม่มีชื่อ');
  if (record.nextCallAt && !DATE_RE.test(record.nextCallAt)) problems.push(`nextCallAt ไม่ใช่ YYYY-MM-DD: ${record.nextCallAt}`);
  if (!record.profile || typeof record.profile !== 'object') problems.push('ไม่มี profile');
  return problems.map(problem => `${record.externalRef || record.name}: ${problem}`);
}

export function leadIdForRecord(record: SegmentImportRecord) {
  return `l_${record.externalRef.replace(/[^A-Za-z0-9]+/g, '_')}`;
}

export interface BuildSegmentLeadOptions {
  ownerId: string;
  actorId: string;
  now: Date;
  existing?: (Lead & Record<string, any>) | null;
}

/**
 * Build the lead document to write.
 * Re-running the import refreshes the research data but never rolls back work done in the CRM:
 * stage only moves forward from "TargetSchool", and owner / notes / contacts edited by users are kept.
 */
export function buildSegmentLeadDoc(record: SegmentImportRecord, options: BuildSegmentLeadOptions) {
  const { ownerId, actorId, now, existing } = options;
  const importedStage = normalizeLeadStage(record.stage || 'TargetSchool') as SalesFunnelStage;
  const existingStage = existing ? (normalizeLeadStage(existing.stage) as SalesFunnelStage) : undefined;
  const stage = existingStage && existingStage !== 'TargetSchool' ? existingStage : importedStage;
  const contacts = (record.contacts || []).map(sanitizeContact).filter(Boolean) as Lead['contacts'];
  const province = record.province || '';
  const meetingArea = typeof record.profile.meetingArea === 'string' ? record.profile.meetingArea : '';
  const address = record.segment === 'university' && meetingArea ? meetingArea : province;

  const base = {
    schoolName: record.name.trim(),
    segment: record.segment,
    externalRef: record.externalRef,
    segmentProfile: record.profile,
    address,
    province,
    zone: record.zone || 'ภาคกลาง',
    campaign: record.campaign,
    source: 'Excel Research',
    updatedAt: now,
  };

  if (existing) {
    return {
      ...existing,
      ...base,
      stage,
      status: statusFromStage(stage),
      score: existingStage === stage ? existing.score : scoreFromStage(stage),
      contacts: existing.contacts?.length ? existing.contacts : contacts,
      nextCallAt: existing.nextCallAt || record.nextCallAt,
      lastContactedAt: existing.lastContactedAt || record.lastContactedAt,
    };
  }

  return {
    _id: leadIdForRecord(record),
    ...base,
    stage,
    status: statusFromStage(stage),
    score: scoreFromStage(stage),
    lastContactedAt: record.lastContactedAt,
    nextCallAt: record.nextCallAt,
    isTest: false,
    archived: false,
    contacts,
    assignedTo: ownerId,
    assignmentHistory: [{ toUserId: ownerId, changedBy: actorId, reason: 'Excel import (segment)', changedAt: now }],
    notes: [{
      author: 'ระบบนำเข้า',
      content: record.segment === 'corporate'
        ? `นำเข้าจากไฟล์ Corporate Sales Launch (${record.externalRef.split(':')[1]})`
        : `นำเข้าจากไฟล์ Faculty Orientation Research (${record.externalRef.split(':')[1]})`,
      type: 'General' as const,
      createdAt: now,
    }],
    attachments: [],
    createdAt: now,
  };
}

export function summarizeRecords(records: SegmentImportRecord[]) {
  const bySegment: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  let withNextCall = 0;
  for (const record of records) {
    bySegment[record.segment] = (bySegment[record.segment] || 0) + 1;
    const key = `${record.segment}:${normalizeLeadStage(record.stage || 'TargetSchool')}`;
    byStage[key] = (byStage[key] || 0) + 1;
    if (record.nextCallAt) withNextCall += 1;
  }
  return { total: records.length, bySegment, byStage, withNextCall };
}
