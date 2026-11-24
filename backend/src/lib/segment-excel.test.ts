import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { corporateStage, readSegmentWorkbook, splitContact, universityStage } from './segment-excel.js';
import { mergeContacts, resolveReimportNextCall, resolveReimportStage } from './segment-import.js';

const importsDir = fileURLToPath(new URL('../../data/imports', import.meta.url));
const xlsxFiles = fs.existsSync(importsDir) ? fs.readdirSync(importsDir).filter(name => /\.xlsx$/i.test(name) && !name.startsWith('~$')) : [];

describe('splitContact', () => {
  it('keeps extensions so faculties sharing a switchboard stay distinct', () => {
    expect(splitContact('02-579-1111 ต่อ 1915')).toEqual({ phone: '02-579-1111 (1915)', emails: [] });
  });
  it('separates phone and email', () => {
    expect(splitContact('02-694-6600; contact@banpu.co.th')).toEqual({ phone: '02-694-6600', emails: ['contact@banpu.co.th'] });
  });
  it('drops short hotline numbers that the contact form would reject', () => {
    expect(splitContact('1509 (Call Center)').phone).toBeUndefined();
  });
});

describe('stage mapping from sheet words', () => {
  it('corporate "ขั้นตอน"', () => {
    expect(corporateStage('ยังไม่ติดต่อ')).toBe('TargetSchool');
    expect(corporateStage('ติดต่อแล้ว')).toBe('Called');
    expect(corporateStage('นัดหมายแล้ว')).toBe('Appointed');
    expect(corporateStage('ส่งใบเสนอราคา')).toBe('Quotation');
    expect(corporateStage('ปิดการขาย')).toBe('Won');
    expect(corporateStage(undefined)).toBe('TargetSchool');
  });
  it('university "สถานะติดต่อ"', () => {
    expect(universityStage('ติดต่อแล้ว')).toBe('Called');
    expect(universityStage('นัดเก็บโจทย์')).toBe('Appointed');
    expect(universityStage('เก็บโจทย์แล้ว')).toBe('Presented');
    expect(universityStage('')).toBe('TargetSchool');
  });
});

describe('re-import rules', () => {
  const snapshot = { stage: 'Called', nextCallAt: '2026-11-18', importedAt: new Date() };
  it('file change moves the deal forward', () => {
    expect(resolveReimportStage('Called', 'Appointed', snapshot)).toBe('Appointed');
  });
  it('file never rolls back CRM progress', () => {
    expect(resolveReimportStage('Quotation', 'Appointed', snapshot)).toBe('Quotation');
  });
  it('unchanged file keeps whatever the team set, even a step back', () => {
    expect(resolveReimportStage('Lost', 'Called', snapshot)).toBe('Lost');
  });
  it('file can close a deal as Won or Lost', () => {
    expect(resolveReimportStage('Quotation', 'Lost', snapshot)).toBe('Lost');
  });
  it('new follow-up date in the file wins, unchanged one keeps the CRM date', () => {
    expect(resolveReimportNextCall('2026-12-01', '2026-11-30', snapshot)).toBe('2026-11-30');
    expect(resolveReimportNextCall('2026-12-01', '2026-11-18', snapshot)).toBe('2026-12-01');
  });
  it('adds new contacts from the file, keeps edited ones', () => {
    const merged = mergeContacts([{ name: 'คุณเอ', phone: '0811111111' }], [{ name: 'คุณเอ', phone: '' }, { name: 'คุณบี', phone: '' }]);
    expect(merged.map(contact => contact.name)).toEqual(['คุณเอ', 'คุณบี']);
  });
});

// Runs only when the real workbooks are in data/imports (they are not committed).
describe.skipIf(!xlsxFiles.length)('workbooks in data/imports', () => {
  it('match data/segment-leads.json when nothing changed since the last import', async () => {
    const snapshot = JSON.parse(fs.readFileSync(new URL('../../data/segment-leads.json', import.meta.url), 'utf8')).records;
    const fromExcel = new Map<string, unknown>();
    for (const name of xlsxFiles) {
      const { records } = await readSegmentWorkbook(path.join(importsDir, name));
      for (const record of records) fromExcel.set(record.externalRef, JSON.parse(JSON.stringify(record)));
    }
    for (const record of snapshot) expect(fromExcel.get(record.externalRef)).toEqual(record);
  });
});
