/**
 * Read the two research workbooks and turn them into SegmentImportRecord[].
 *
 *  - Corporate:  "Nextgen_Corporate_Sales_Launch*.xlsx"  (sheet "รายชื่อทั่วประเทศ")
 *  - University: "Nextgen_Faculty_Orientation_Research*.xlsx" (sheet "เจาะรายคณะ")
 *
 * Files are recognised by their sheet names, not their file names, so a renamed / dated copy still works.
 * Same mapping as scripts/excel-to-segment-leads.py (kept for reference).
 */
import fs from 'fs';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { SegmentImportRecord } from './segment-import.js';

type Row = Record<string, string | number | boolean>;
export type WorkbookKind = 'corporate' | 'university';

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+?\d[\d\-\s()]{4,18}\d/;

// ------------------------------------------------------------------ cell helpers
function cellValue(raw: ExcelJS.CellValue): string | number | boolean | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw === 'object') {
    const value = raw as any;
    if ('result' in value) return cellValue(value.result);
    if ('richText' in value) return cellValue(value.richText.map((part: any) => part.text).join(''));
    if ('text' in value) return cellValue(value.text ?? value.hyperlink);
    if ('error' in value) return null;
  }
  return cellValue(String(raw));
}

/** Rows of a sheet as objects keyed by header; the header row is found by its ID column name. */
export function readTable(ws: ExcelJS.Worksheet, idColumn: string, idPattern: RegExp): Row[] {
  let headerRow = 0;
  let headers: string[] = [];
  for (let r = 1; r <= Math.min(ws.rowCount, 30); r += 1) {
    const values = (ws.getRow(r).values as ExcelJS.CellValue[]).map(cellValue);
    if (values.includes(idColumn)) {
      headerRow = r;
      headers = values.map(value => (value === null ? '' : String(value)));
      break;
    }
  }
  if (!headerRow) throw new Error(`ชีท "${ws.name}" ไม่พบคอลัมน์ "${idColumn}"`);
  const rows: Row[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
    const values = ws.getRow(r).values as ExcelJS.CellValue[];
    const record: Row = {};
    headers.forEach((header, col) => {
      if (!header) return;
      const value = cellValue(values[col]);
      if (value !== null) record[header] = value;
    });
    const id = record[idColumn];
    if (typeof id === 'string' && idPattern.test(id)) rows.push(record);
  }
  return rows;
}

function pick(row: Row, mapping: Record<string, string>) {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, column] of Object.entries(mapping)) {
    if (row[column] !== undefined) out[key] = row[column];
  }
  return out;
}

/** Split a free-text channel cell into a phone (kept with its extension) and emails. */
export function splitContact(raw: unknown): { phone?: string; emails: string[] } {
  if (raw === null || raw === undefined || raw === '') return { emails: [] };
  const text = String(raw);
  const emails = text.match(EMAIL_RE) || [];
  const rest = text.replace(EMAIL_RE, ' ');
  const match = PHONE_RE.exec(rest);
  if (!match) return { emails };
  let candidate = match[0].replace(/\s+/g, ' ').trim();
  const ext = /^\s*ต่อ\s*(\d{1,5})/.exec(rest.slice(match.index + match[0].length));
  if (ext && `${candidate} (${ext[1]})`.length <= 20) candidate = `${candidate} (${ext[1]})`;
  const digits = candidate.replace(/\D/g, '');
  if (candidate.length >= 6 && candidate.length <= 20 && digits.length >= 6) return { phone: candidate, emails };
  return { emails };
}

// ------------------------------------------------------------------ corporate
const REGION_TO_ZONE: Record<string, string> = {
  กลาง: 'ภาคกลาง',
  เหนือ: 'ภาคเหนือ',
  ใต้: 'ภาคใต้',
  ตะวันออก: 'ภาคตะวันออก',
  ตะวันตก: 'ภาคตะวันตก',
  ตะวันออกเฉียงเหนือ: 'ภาคอีสาน',
};

const CORP_MASTER = {
  code: 'ID', region: 'ภูมิภาค', orgType: 'ประเภทองค์กร', locationNote: 'สถานะที่ตั้ง',
  tier: 'ลำดับ (สูตร)', evidence: 'หลักฐานที่พบ', serviceOffer: 'บริการที่ควรเสนอ',
  targetRole: 'บทบาทที่ควรสอบถาม', directProjectEvidence: 'หลักฐานโครงการตรง',
  confirmedNeed: 'โจทย์ยืนยัน', confirmedOwner: 'เจ้าของโครงการยืนยัน',
  confirmedWithin6Months: 'จัดภายใน 6 เดือนยืนยัน', confirmedBudget: 'งบและวิธีซื้อยืนยัน',
  officialChannelUrl: 'ช่องทางกลางทางการ', centralContact: 'เบอร์กลาง/ทางเข้าหา',
  toVerify: 'สิ่งที่ต้องตรวจเพิ่ม', budgetGroup: 'กลุ่มงบที่ต้องตรวจ', checkedAt: 'ตรวจข้อมูลเมื่อ',
  evidenceUrl: 'URL หลักฐาน', evidenceYear: 'ปีของหลักฐาน (พ.ศ.)', evidenceYearBasis: 'ฐานปีของหลักฐาน',
  activityKind: 'ลักษณะกิจกรรม', eventStatus2569: 'สถานะงานปี 2569',
  confirmedEventDate: 'วันจัดที่ยืนยัน (ค.ศ.)', newsDate: 'วันเผยแพร่ข่าว (ค.ศ.)',
  procurementStatus: 'สถานะจัดซื้อ', recommendedRound: 'รอบขายแนะนำ',
  nextAction: 'สิ่งที่ทีมขายควรทำต่อ', statusEvidenceLevel: 'ระดับหลักฐานสถานะ',
  checkScope: 'ขอบเขตที่ตรวจ', statusUrl: 'URL ยืนยันสถานะ', reviewedAt: 'วันที่ทบทวน (ค.ศ.)',
};
const CORP_DEAL = {
  followerRole: 'ผู้ติดตามหลัก', dealStep: 'ขั้นตอน', lastContactedAt: 'ติดต่อครั้งล่าสุด',
  nextAppointmentAt: 'วันที่นัดถัดไป', nextTask: 'งานถัดไป', needOrConfirmedDate: 'โจทย์/วันจัดที่ยืนยัน',
  buyerChannel: 'ผู้ซื้อ/ช่องทางยืนยัน', proposedValue: 'มูลค่าเสนอ (บาท)', expectedDecision: 'คาดตัดสินใจ',
  contractValue: 'มูลค่าสัญญายืนยัน (บาท)', receivedAmount: 'เงินรับจริง (บาท)',
  lostReason: 'เหตุผลแพ้/เลื่อน', lastContactResult: 'ผลติดต่อล่าสุด',
  dealEventStatus: 'สถานะงานปี 2569', dealProcurementStatus: 'สถานะจัดซื้อ',
  followupFromStatus: 'งานต่อจากสถานะกิจกรรม',
};
const CORP_TOP20 = {
  initialOffer: 'ข้อเสนอเริ่มต้น', approach: 'ทางเข้าหา',
  top20Channel: 'เบอร์ / อีเมลกลาง', contactUrl: 'URL ช่องทางติดต่อ',
  infoToAsk: 'ข้อมูลที่ต้องถามเพิ่ม', confirmedContactName: 'ชื่อผู้ดูแลที่ยืนยันแล้ว',
};

/**
 * "ขั้นตอน" in sheet ติดตามดีล → CRM stage. Only "ยังไม่ติดต่อ" exists in the current file;
 * the rest follow the same words the sales team uses, so new values keep working.
 */
const CORP_STEP_TO_STAGE: Array<[RegExp, string]> = [
  [/ยังไม่ติดต่อ/, 'TargetSchool'],
  [/แพ้|ยกเลิก|ไม่สนใจ|lost/i, 'Lost'],
  [/ปิด|ชนะ|ได้งาน|เซ็นสัญญา|won/i, 'Won'],
  [/ใบเสนอราคา|เสนอราคา|quotation/i, 'Quotation'],
  [/demo|workshop|ทดลอง/i, 'DemoWorkshop'],
  [/present|นำเสนอ/i, 'Presented'],
  [/นัด/, 'Appointed'],
  [/ส่งเอกสาร|เอกสาร/, 'DocumentSent'],
  [/ติดต่อ|โทร|call/i, 'Called'],
];

export function corporateStage(step: unknown) {
  if (typeof step !== 'string' || !step.trim()) return 'TargetSchool';
  return CORP_STEP_TO_STAGE.find(([pattern]) => pattern.test(step))?.[1] || 'TargetSchool';
}

export function corporateRecords(wb: ExcelJS.Workbook): SegmentImportRecord[] {
  const master = readTable(wb.getWorksheet('รายชื่อทั่วประเทศ')!, 'ID', /^L\d+$/);
  const dealSheet = wb.getWorksheet('ติดตามดีล');
  const topSheet = wb.getWorksheet('ลูกค้าเป้าหมาย');
  const deals = new Map((dealSheet ? readTable(dealSheet, 'ID', /^L\d+$/) : []).map(row => [row.ID as string, row]));
  const top = new Map((topSheet ? readTable(topSheet, 'ID', /^L\d+$/) : []).map(row => [row.ID as string, row]));

  return master.map(row => {
    const code = row.ID as string;
    const profile: Record<string, any> = pick(row, CORP_MASTER);
    const deal = deals.get(code) || {};
    const dealProfile: Record<string, any> = pick(deal, CORP_DEAL);
    if (['0', 'ค่า'].includes(String(dealProfile.followerRole ?? ''))) delete dealProfile.followerRole;
    if (dealProfile.dealEventStatus === profile.eventStatus2569) delete dealProfile.dealEventStatus;
    if (dealProfile.dealProcurementStatus === profile.procurementStatus) delete dealProfile.dealProcurementStatus;
    Object.assign(profile, dealProfile);
    const topRow = top.get(code);
    if (topRow) Object.assign(profile, pick(topRow, CORP_TOP20));
    profile.isTop20 = Boolean(topRow);

    const contacts: SegmentImportRecord['contacts'] = [];
    const channel = profile.centralContact || profile.top20Channel;
    const { phone, emails } = splitContact(channel);
    if (phone || emails.length) {
      contacts.push({
        name: 'ช่องทางกลาง',
        position: [profile.targetRole, channel].filter(Boolean).join(' · '),
        ...(phone ? { phone } : {}),
        ...(emails.length ? { email: emails[0] } : {}),
      });
    }
    if (profile.confirmedContactName) contacts.push({ name: String(profile.confirmedContactName), position: 'ผู้ดูแลที่ยืนยันแล้ว' });

    const record: SegmentImportRecord = {
      externalRef: `corporate:${code}`,
      segment: 'corporate',
      name: String(row['องค์กร/หน่วยเป้าหมาย'] ?? ''),
      province: row['จังหวัดเป้าหมาย'] as string | undefined,
      zone: REGION_TO_ZONE[String(row['ภูมิภาค'])] || 'ภาคกลาง',
      stage: corporateStage(deal['ขั้นตอน']),
      lastContactedAt: profile.lastContactedAt,
      nextCallAt: profile.nextAppointmentAt,
      campaign: 'Corporate Sales Launch 2569',
      contacts,
      profile,
    };
    return dropUndefined(record);
  });
}

// ------------------------------------------------------------------ university
const UNI_MAIN = {
  facultyCode: 'รหัสคณะ', approachOrder: 'ลำดับเข้าหาเสนอ', institutionType: 'ประเภท',
  university: 'มหาวิทยาลัย', faculty: 'คณะ / วิทยาลัย', meetingArea: 'พื้นที่นัดหมาย',
  tier: 'ระดับหลักฐาน', activityEvidence: 'กิจกรรม / หลักฐานที่พบ',
  evidenceYear: 'ปีหลักฐาน / วันจัด', facultyVoice: 'เสียงคณะที่เผยแพร่ (สรุป)',
  pastBudget: 'งบปฐมนิเทศย้อนหลัง (บาท)', fiscalYear: 'ปีงบประมาณ', newBudgetStatus: 'สถานะงบรอบใหม่',
  pitchAngle: 'มุมเสนอ BEYOND FIRST MEET (เสนอ)', insight: 'Insight ที่ควรคุย (เสนอ)',
  selectionReason: 'เหตุผลคัดเข้าหา', evidenceLimit: 'ข้อจำกัดหลักฐาน', nextRound: 'รอบกิจกรรมถัดไป',
  activityUrl: 'URL กิจกรรม / งบ', supportUrl: 'URL ประกอบ', webCheckedAt: 'วันที่ตรวจเว็บ',
};
const UNI_CONTACT = {
  targetRole: 'ผู้ที่ควรขอคุย', phoneRaw: 'โทรศัพท์จากเว็บ', emailRaw: 'อีเมลจากเว็บ',
  channelScope: 'ขอบเขตช่องทาง', openQuestion: 'คำถามเปิดฟังเสียงคณะ',
  painQuestion: 'คำถามเจาะปัญหา / ผลลัพธ์', budgetQuestion: 'คำถามงบ / ผู้อนุมัติ / วิธีซื้อ',
  realVoice: 'เสียงจากคณะจริง (รอกรอก)', confirmedBuyer: 'ผู้ซื้อ / ผู้อนุมัติยืนยัน',
  confirmedNewBudget: 'งบรอบใหม่ยืนยัน (บาท)', purchaseMethod: 'วิธีซื้อ / งบร่วม',
  confirmedDecisionDate: 'วันที่ตัดสินใจยืนยัน', confirmedEventDate: 'วันจัดยืนยัน',
  followerRole: 'ผู้ติดตามหลัก', nextTask: 'งานถัดไปเสนอ', followUpDate: 'กำหนดติดตามเสนอ',
  contactStatus: 'สถานะติดต่อ', newBudgetStatusDetail: 'สถานะงบรอบใหม่',
  limitation: 'ข้อจำกัด / จุดต้องตรวจสอบ', contactUrl: 'URL ช่องทางติดต่อ',
};
const UNI_START5 = { startFirstReason: 'เหตุผลที่เริ่มก่อน', pastBudgetText: 'งบย้อนหลัง / สถานะ', firstQuestion: 'คำถามแรก' };

/** "สถานะติดต่อ" → CRM stage. Order matters: "เก็บโจทย์แล้ว" before "นัดเก็บโจทย์". */
const UNI_STATUS_TO_STAGE: Array<[RegExp, string]> = [
  [/แพ้|ยกเลิก|ไม่สนใจ/, 'Lost'],
  [/ปิด|ได้งาน|เซ็นสัญญา|ยืนยันจ้าง/, 'Won'],
  [/ใบเสนอราคา|เสนอราคา/, 'Quotation'],
  [/เก็บโจทย์แล้ว|นำเสนอแล้ว|present/i, 'Presented'],
  [/นัด/, 'Appointed'],
  [/ส่งเอกสาร/, 'DocumentSent'],
  [/ติดต่อแล้ว|โทรแล้ว/, 'Called'],
];

export function universityStage(status: unknown) {
  if (typeof status !== 'string' || !status.trim()) return 'TargetSchool';
  return UNI_STATUS_TO_STAGE.find(([pattern]) => pattern.test(status))?.[1] || 'TargetSchool';
}

const AREA_TO_PROVINCE: Array<[string, string]> = [['ปทุมธานี', 'ปทุมธานี'], ['นครปฐม', 'นครปฐม'], ['กรุงเทพ', 'กรุงเทพมหานคร']];

export function universityRecords(wb: ExcelJS.Workbook): SegmentImportRecord[] {
  const main = readTable(wb.getWorksheet('เจาะรายคณะ')!, 'รหัสคณะ', /^FAC-\d+$/);
  const contactSheet = wb.getWorksheet('ติดต่อและฟังเสียง');
  const startSheet = wb.getWorksheet('เริ่มที่5คณะ');
  const contacts = new Map((contactSheet ? readTable(contactSheet, 'รหัสคณะ', /^FAC-\d+$/) : []).map(row => [row['รหัสคณะ'] as string, row]));
  const start5 = new Map((startSheet ? readTable(startSheet, 'รหัสคณะ', /^FAC-\d+$/) : []).map(row => [row['รหัสคณะ'] as string, row]));

  return main.map(row => {
    const code = row['รหัสคณะ'] as string;
    const profile: Record<string, any> = pick(row, UNI_MAIN);
    const contactProfile: Record<string, any> = pick(contacts.get(code) || {}, UNI_CONTACT);
    if (contactProfile.newBudgetStatusDetail === profile.newBudgetStatus) delete contactProfile.newBudgetStatusDetail;
    Object.assign(profile, contactProfile);
    const startRow = start5.get(code);
    profile.startFirst = Boolean(startRow);
    if (startRow) Object.assign(profile, pick(startRow, UNI_START5));

    const leadContacts: SegmentImportRecord['contacts'] = [];
    const { phone } = splitContact(profile.phoneRaw);
    const { emails } = splitContact(profile.emailRaw);
    if (phone || emails.length) {
      leadContacts.push({
        name: 'สำนักงานคณะ (ช่องทางกลาง)',
        position: [profile.targetRole, profile.phoneRaw].filter(Boolean).join(' · '),
        ...(phone ? { phone } : {}),
        ...(emails.length ? { email: emails[0] } : {}),
      });
    }
    const buyer = profile.confirmedBuyer;
    if (typeof buyer === 'string' && buyer && !buyer.startsWith('ยังไม่พบ')) {
      leadContacts.push({ name: buyer, position: 'ผู้ประสาน/ผู้มีอำนาจ (รอยืนยัน)' });
    }

    const area = String(profile.meetingArea || '');
    const province = AREA_TO_PROVINCE.find(([key]) => area.includes(key))?.[1] || 'กรุงเทพมหานคร';
    const record: SegmentImportRecord = {
      externalRef: `university:${code}`,
      segment: 'university',
      name: `${profile.faculty} ${profile.university}`,
      province,
      zone: 'ภาคกลาง',
      stage: universityStage(profile.contactStatus),
      nextCallAt: profile.followUpDate,
      campaign: 'BEYOND FIRST MEET — Faculty Orientation 2570',
      contacts: leadContacts,
      profile,
    };
    return dropUndefined(record);
  });
}

// ------------------------------------------------------------------ entry points
export function detectWorkbookKind(wb: ExcelJS.Workbook): WorkbookKind | null {
  const names = wb.worksheets.map(ws => ws.name);
  if (names.includes('รายชื่อทั่วประเทศ')) return 'corporate';
  if (names.includes('เจาะรายคณะ')) return 'university';
  return null;
}

/**
 * Excel "tables" (Format as Table) are not needed for reading, and exceljs crashes on some of them
 * (e.g. files re-saved by other tools with absolute part paths). Remove them before parsing.
 */
async function stripTables(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;
  for (const name of Object.keys(zip.files)) {
    if (/^xl\/tables\//.test(name)) {
      zip.remove(name);
      changed = true;
    } else if (/^xl\/worksheets\/_rels\/.+\.rels$/.test(name)) {
      const xml = await zip.file(name)!.async('string');
      const next = xml.replace(/<Relationship\b[^>]*relationships\/table"[^>]*\/>/g, '');
      if (next !== xml) { zip.file(name, next); changed = true; }
    } else if (/^xl\/worksheets\/[^/]+\.xml$/.test(name)) {
      const xml = await zip.file(name)!.async('string');
      const next = xml.replace(/<tableParts\b[^>]*\/>|<tableParts\b[\s\S]*?<\/tableParts>/g, '');
      if (next !== xml) { zip.file(name, next); changed = true; }
    } else if (name === '[Content_Types].xml') {
      const xml = await zip.file(name)!.async('string');
      const next = xml.replace(/<Override\b[^>]*PartName="\/xl\/tables\/[^"]*"[^>]*\/>/g, '');
      if (next !== xml) { zip.file(name, next); changed = true; }
    }
  }
  return changed ? zip.generateAsync({ type: 'nodebuffer' }) : buffer;
}

export async function readSegmentWorkbook(filePath: string) {
  const wb = new ExcelJS.Workbook();
  const buffer = await stripTables(fs.readFileSync(filePath));
  await wb.xlsx.load(buffer as any);
  const kind = detectWorkbookKind(wb);
  if (!kind) return { kind: null, records: [] as SegmentImportRecord[] };
  return { kind, records: kind === 'corporate' ? corporateRecords(wb) : universityRecords(wb) };
}

function dropUndefined<T extends Record<string, any>>(record: T): T {
  for (const key of Object.keys(record)) if (record[key] === undefined || record[key] === null) delete record[key];
  return record;
}
