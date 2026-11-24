import fs from 'fs';
import { describe, expect, it } from 'vitest';
import {
  buildSegmentLeadDoc,
  leadIdForRecord,
  sanitizeContact,
  summarizeRecords,
  validateRecord,
  type SegmentImportFile,
  type SegmentImportRecord,
} from './segment-import.js';
import {
  buildSegmentFacets,
  extractProfileFilters,
  matchesProfileFilters,
  normalizeLeadSegment,
  parseSegmentFilter,
} from '../config/lead-segments.js';

const dataFile = JSON.parse(
  fs.readFileSync(new URL('../../data/segment-leads.json', import.meta.url), 'utf8')
) as SegmentImportFile;

const now = new Date('2026-11-24T03:00:00Z');

const universityRecord: SegmentImportRecord = {
  externalRef: 'university:FAC-001',
  segment: 'university',
  name: 'คณะวิศวกรรมศาสตร์ มทร.พระนคร',
  province: 'กรุงเทพมหานคร',
  zone: 'ภาคกลาง',
  stage: 'Called',
  nextCallAt: '2026-11-18',
  contacts: [{ name: 'สำนักงานคณะ', position: 'กิจการนักศึกษา', phone: '02-836-3000', email: 'eng@rmutp.ac.th' }],
  profile: { facultyCode: 'FAC-001', university: 'มทร.พระนคร', meetingArea: 'บางซื่อ กรุงเทพฯ', tier: 'B', startFirst: true },
};

describe('segment-leads.json (generated from the two Excel files)', () => {
  it('contains 135 corporate accounts and 11 faculties, all valid', () => {
    const summary = summarizeRecords(dataFile.records);
    expect(summary.bySegment).toEqual({ corporate: 135, university: 11 });
    expect(dataFile.records.flatMap(validateRecord)).toEqual([]);
  });

  it('has unique externalRefs and lead ids', () => {
    const refs = dataFile.records.map(record => record.externalRef);
    expect(new Set(refs).size).toBe(refs.length);
    const ids = dataFile.records.map(leadIdForRecord);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only stores contacts that pass the API contact schema', () => {
    for (const record of dataFile.records) {
      for (const contact of record.contacts || []) {
        const clean = sanitizeContact(contact)!;
        if (clean.phone) expect(clean.phone).toMatch(/^[0-9+\-\s()]{6,20}$/);
      }
    }
  });
});

describe('buildSegmentLeadDoc', () => {
  it('creates a new lead linked by externalRef with owner and import note', () => {
    const doc = buildSegmentLeadDoc(universityRecord, { ownerId: 'u3', actorId: 'u3', now }) as any;
    expect(doc._id).toBe('l_university_FAC_001');
    expect(doc.segment).toBe('university');
    expect(doc.stage).toBe('Called');
    expect(doc.status).toBe('Cold');
    expect(doc.address).toBe('บางซื่อ กรุงเทพฯ');
    expect(doc.assignedTo).toBe('u3');
    expect(doc.nextCallAt).toBe('2026-11-18');
    expect(doc.notes).toHaveLength(1);
  });

  it('does not roll back CRM progress or overwrite user edits on re-import', () => {
    const existing = {
      _id: 'l_university_FAC_001',
      schoolName: 'old name',
      stage: 'Quotation',
      score: 77,
      assignedTo: 'u4',
      contacts: [{ name: 'คุณเอ', position: 'ผอ.', phone: '0811111111' }],
      notes: [{ author: 'u4', content: 'คุยแล้ว', createdAt: now }],
      nextCallAt: '2026-12-01',
    } as any;
    const doc = buildSegmentLeadDoc(universityRecord, { ownerId: 'u3', actorId: 'u3', now, existing }) as any;
    expect(doc.schoolName).toBe(universityRecord.name);
    expect(doc.stage).toBe('Quotation');
    expect(doc.score).toBe(77);
    expect(doc.assignedTo).toBe('u4');
    expect(doc.contacts[0].name).toBe('คุณเอ');
    expect(doc.notes).toHaveLength(1);
    expect(doc.nextCallAt).toBe('2026-12-01');
    expect(doc.segmentProfile).toEqual(universityRecord.profile);
  });
});

describe('lead-segments filters', () => {
  it('treats legacy leads without segment as school', () => {
    expect(normalizeLeadSegment(undefined)).toBe('school');
    expect(normalizeLeadSegment('corporate')).toBe('corporate');
    expect(parseSegmentFilter('All')).toBeNull();
    expect(parseSegmentFilter('university')).toBe('university');
  });

  it('applies whitelisted pf.* filters only', () => {
    const filters = extractProfileFilters({ 'pf.tier': 'B', 'pf.startFirst': 'true', 'pf.secret': 'x', search: 'a' });
    expect(filters).toEqual({ tier: 'B', startFirst: 'true', secret: 'x' });
    const lead = { segment: 'university', segmentProfile: { tier: 'B', startFirst: true } };
    expect(matchesProfileFilters(lead, 'university', filters)).toBe(true);
    expect(matchesProfileFilters(lead, 'university', { tier: 'C' })).toBe(false);
  });

  it('builds facet counts from real data', () => {
    const corporate = dataFile.records
      .filter(record => record.segment === 'corporate')
      .map(record => ({ segmentProfile: record.profile }));
    const facets = buildSegmentFacets(corporate, 'corporate');
    expect(facets.tier).toEqual([{ value: 'C', count: 118 }, { value: 'B', count: 17 }]);
    expect(facets.isTop20.find(item => item.value === 'true')?.count).toBe(20);
  });
});
