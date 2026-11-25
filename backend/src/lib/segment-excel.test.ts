import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { corporateStage, dropEmptyDuplicateRows, inlineStringsToPlain, readSegmentWorkbook, splitContact, toIsoDate, universityStage } from './segment-excel.js';
import { mergeContacts, resolveReimportNextCall, resolveReimportStage, validateRecord } from './segment-import.js';

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

describe('xlsx quirks', () => {
  it('reads inline string cells', () => {
    expect(inlineStringsToPlain('<c r="A1" s="5" t="inlineStr"><is><t>L136</t></is></c>')).toBe('<c r="A1" s="5" t="str"><v>L136</v></c>');
  });
  it('drops an empty duplicate of a row that has data', () => {
    const xml = '<row r="142"><c r="A142"><v>1</v></c></row><row r="143"/><row r="142" ht="15"></row>';
    expect(dropEmptyDuplicateRows(xml)).toBe('<row r="142"><c r="A142"><v>1</v></c></row><row r="143"/>');
  });
});

describe('toIsoDate', () => {
  it('keeps real dates and reads Thai-style D/M/YYYY', () => {
    expect(toIsoDate('2026-12-03')).toBe('2026-12-03');
    expect(toIsoDate('3/12/2569')).toBe('2026-12-03');
    expect(toIsoDate('03/12/2026')).toBe('2026-12-03');
  });
  it('treats placeholder words as no date', () => {
    expect(toIsoDate('ยังไม่นัด')).toBeUndefined();
    expect(toIsoDate('ยังไม่ติดต่อ')).toBeUndefined();
    expect(toIsoDate(undefined)).toBeUndefined();
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

// Runs only when real workbooks are in data/imports (they are not committed).
describe.skipIf(!xlsxFiles.length)('workbooks in data/imports', () => {
  it('every row is importable', async () => {
    for (const name of xlsxFiles) {
      const { records } = await readSegmentWorkbook(path.join(importsDir, name));
      expect(records.flatMap(validateRecord)).toEqual([]);
    }
  });
});
