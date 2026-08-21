import zlib from 'zlib';
import {
  isSalesFunnelStage,
  normalizeLeadStage,
  type SalesFunnelStage,
} from '../config/sales-funnel-stages.js';
import type { Lead } from '../types/index.js';

export type LeadStatus = Lead['status'];
export type LeadImportDraft = Lead;

export interface ImportUser {
  _id: string;
  name: string;
  roleId?: string;
}

const LEAD_STATUSES = ['Cold', 'Warm', 'Hot', 'Customer'] as const;

const HEADER_ALIASES: Record<string, string[]> = {
  schoolName: ['schoolName', 'name', 'รายชื่อโรงเรียน', 'โรงเรียน', '__col_A'],
  gradeLevels: ['gradeLevels', 'ระดับชั้น', '__col_B'],
  educationAuthority: ['educationAuthority', 'สังกัด', '__col_C'],
  district: ['district', 'เขต', '__col_D'],
  province: ['province', 'จังหวัด', '__col_E'],
  studentCount: ['studentCount', 'จำนวน นร.', '__col_F'],
  upperElementaryStudentCount: ['upperElementaryStudentCount', 'จำนวน นร. ป.4-6', '__col_G'],
  schoolSize: ['ขนาดโรงเรียน', '__col_H'],
  status: ['status', 'สถานะ', '__col_I'],
  stage: ['stage', 'อยู่ในขั้นตอน', '__col_J'],
  lastContactedAt: ['lastContactedAt', 'ติดต่อลูกค้าล่าสุด', '__col_L'],
  nextCallAt: ['nextCallAt', 'นัดโทรครั้งถัดไป', '__col_M'],
  phone: ['phone', 'contactPhone', 'เบอร์โทร', '__col_N'],
  email: ['email', 'contactEmail', 'อีเมล', '__col_O'],
  contactName: ['contactName', 'ผู้ติดต่อ'],
  documentStatus: ['documentStatus', 'Ps / ยื่นหนังสือ /Trial', 'Ps / ยื่นหนังสือ', '__col_P'],
  remarks: ['remarks', 'Remarks', '__col_Q'],
  sale: ['legacySaleName', 'Sale', 'sale', '__col_S'],
  zone: ['zone'],
  source: ['source'],
  campaign: ['campaign'],
  address: ['address'],
};

const STATUS_TO_STAGE: Record<string, SalesFunnelStage> = {
  call: 'Call',
  meeting: 'Meeting',
  นัดหมาย: 'Meeting',
  presentation: 'Presentation',
  present: 'Presentation',
  demoworkshop: 'DemoWorkshop',
  'demo/workshop': 'DemoWorkshop',
  quotation: 'Quotation',
  won: 'Won',
  lost: 'Lost',
  pending: 'Call',
};

const STEP_TO_STAGE: Record<string, SalesFunnelStage> = {
  รอยื่นหนังสือ: 'Call',
  ยื่นหนังสือ: 'Meeting',
  ยื่นหนังสือติดตามผล: 'Meeting',
  โทรติดตามซ้ำ: 'Meeting',
  present: 'Presentation',
  presentation: 'Presentation',
  'ผอ.ไม่สนใจ': 'Lost',
  ปิดกิจการ: 'Lost',
  'รร.จะติดต่อกลับมา': 'Call',
  ไม่มีคนรับสายติดต่อซ้ำ: 'Call',
  pending: 'Call',
  นัดหมาย: 'Meeting',
  call: 'Call',
  lost: 'Lost',
};

function compactText(value?: string) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function compactKey(value?: string) {
  return compactText(value).toLowerCase();
}

function headerKey(value?: string) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function pickCell(row: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    if (row[alias]?.trim()) return row[alias].trim();
  }
  const wanted = aliases.map(headerKey);
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('__col_') || !value?.trim()) continue;
    if (wanted.includes(headerKey(key))) return value.trim();
  }
  return '';
}

export function pickLeadField(row: Record<string, string>, field: keyof typeof HEADER_ALIASES): string {
  return pickCell(row, HEADER_ALIASES[field]);
}

export function mapStatusLabelToStage(status?: string): SalesFunnelStage | undefined {
  const key = compactKey(status);
  if (!key) return undefined;
  return STATUS_TO_STAGE[key];
}

export function mapLegacyStepToLeadStage(step?: string): SalesFunnelStage {
  const exact = STEP_TO_STAGE[compactKey(step)];
  if (exact) return exact;

  const value = String(step || '').toLowerCase();
  if (!value.trim()) return 'Call';
  if (value.includes('ปิดกิจการ') || value.includes('ไม่สนใจ') || value.includes('closed lost') || value.includes('lost')) return 'Lost';
  if (value.includes('won') || value.includes('ปิดการขาย')) return 'Won';
  if (value.includes('trial') || value.includes('pilot') || value.includes('ทดลอง') || value.includes('proposal') || value.includes('เสนอราคา') || value.includes('quotation')) return 'Quotation';
  if (value.includes('present') || value.includes('พรีเซน')) return 'Presentation';
  if (value.includes('demo') || value.includes('workshop') || value.includes('สาธิต')) return 'DemoWorkshop';
  if (value.includes('นัด') || value.includes('meeting')) return 'Meeting';
  if (value.includes('โทร') || value.includes('call') || value.includes('ติดต่อ') || value.includes('ยื่น') || value.includes('email') || value.includes('อีเมล')) return 'Call';
  return 'Call';
}

export function resolveImportStage(status?: string, step?: string): SalesFunnelStage {
  const fromStatus = mapStatusLabelToStage(status);
  if (fromStatus) return fromStatus;
  if (isSalesFunnelStage(step)) return step;
  if (isSalesFunnelStage(status)) return status;
  return mapLegacyStepToLeadStage(step || status);
}

export function statusFromStage(stage: SalesFunnelStage, rawStatus?: string): LeadStatus {
  const raw = String(rawStatus || '').trim();
  if ((LEAD_STATUSES as readonly string[]).includes(raw) && !mapStatusLabelToStage(raw)) {
    return raw as LeadStatus;
  }
  if (stage === 'Won') return 'Customer';
  if (stage === 'DemoWorkshop' || stage === 'Quotation') return 'Hot';
  if (stage === 'Meeting' || stage === 'Presentation') return 'Warm';
  return 'Cold';
}

export function scoreFromStage(stage: SalesFunnelStage, status: LeadStatus): number {
  if (status === 'Customer' || stage === 'Won') return 100;
  if (status === 'Hot' || stage === 'DemoWorkshop' || stage === 'Quotation') return 85;
  if (status === 'Warm' || stage === 'Meeting' || stage === 'Presentation') return 60;
  if (stage === 'Lost') return 0;
  return 10;
}

export function provinceToZone(province?: string) {
  const normalized = String(province || '').replace(/\s/g, '');
  if (!normalized) return 'ภาคกลาง';
  const east = ['ชลบุรี', 'ระยอง', 'จันทบุรี', 'ตราด', 'ฉะเชิงเทรา', 'ปราจีนบุรี', 'สระแก้ว'];
  const north = ['เชียงใหม่', 'เชียงราย', 'ลำพูน', 'ลำปาง', 'แพร่', 'น่าน', 'พะเยา', 'แม่ฮ่องสอน', 'อุตรดิตถ์', 'พิษณุโลก', 'สุโขทัย', 'ตาก', 'กำแพงเพชร', 'พิจิตร', 'เพชรบูรณ์'];
  const south = ['สุราษฎร์ธานี', 'นครศรีธรรมราช', 'สงขลา', 'ภูเก็ต', 'กระบี่', 'ตรัง', 'พัทลุง', 'ชุมพร', 'ระนอง', 'พังงา', 'สตูล', 'ปัตตานี', 'ยะลา', 'นราธิวาส'];
  const west = ['กาญจนบุรี', 'ราชบุรี', 'เพชรบุรี', 'ประจวบคีรีขันธ์'];
  const isan = ['นครราชสีมา', 'ขอนแก่น', 'อุดรธานี', 'อุบลราชธานี', 'บุรีรัมย์', 'สุรินทร์', 'ศรีสะเกษ', 'ร้อยเอ็ด', 'มหาสารคาม', 'กาฬสินธุ์', 'สกลนคร', 'นครพนม', 'มุกดาหาร', 'เลย', 'หนองคาย', 'บึงกาฬ', 'หนองบัวลำภู', 'ชัยภูมิ', 'ยโสธร', 'อำนาจเจริญ'];
  if (east.some(item => normalized.includes(item))) return 'ภาคตะวันออก';
  if (north.some(item => normalized.includes(item))) return 'ภาคเหนือ';
  if (south.some(item => normalized.includes(item))) return 'ภาคใต้';
  if (west.some(item => normalized.includes(item))) return 'ภาคตะวันตก';
  if (isan.some(item => normalized.includes(item))) return 'ภาคอีสาน';
  return 'ภาคกลาง';
}

export function excelSerialToDateText(value?: string) {
  if (!value || value === '-') return '';
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const serial = Number(trimmed);
  if (!Number.isFinite(serial) || serial < 30000) return trimmed;
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return date.toISOString().slice(0, 10);
}

export function numberFromImportCell(value?: string) {
  const cleaned = String(value || '').replace(/,/g, '').trim();
  if (!cleaned || cleaned === '-') return undefined;
  const numberValue = Number(cleaned);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function emailFromCell(value?: string) {
  return String(value || '').replace(/^mailto:/i, '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

export function leadIdentityKey(lead: { schoolName?: string; district?: string; province?: string }) {
  return [compactKey(lead.schoolName), compactKey(lead.district), compactKey(lead.province)].join('|');
}

export function resolveAssignedUserId(saleName: string | undefined, users: ImportUser[], fallbackId: string) {
  const raw = String(saleName || '').trim();
  if (!raw) return { userId: fallbackId, legacySaleName: undefined as string | undefined };

  const exact = users.find(user => user.name.trim() === raw);
  if (exact) return { userId: exact._id, legacySaleName: raw };

  const salesUsers = users.filter(user => user.roleId === 'r_sales');
  const nick = salesUsers.find(user => user.name.includes(raw) || raw.includes(user.name));
  if (nick) return { userId: nick._id, legacySaleName: raw };

  return { userId: fallbackId, legacySaleName: raw };
}

export interface BuildLeadImportOptions {
  index: number;
  currentUserId: string;
  users?: ImportUser[];
  now?: Date;
}

export function buildLeadFromImportRow(row: Record<string, string>, options: BuildLeadImportOptions): LeadImportDraft {
  const now = options.now || new Date();
  const schoolName = pickLeadField(row, 'schoolName');
  const district = pickLeadField(row, 'district');
  const province = pickLeadField(row, 'province');
  const rawStatus = pickLeadField(row, 'status');
  const legacyStep = pickLeadField(row, 'stage');
  const stage = normalizeLeadStage(resolveImportStage(rawStatus, legacyStep));
  const status = statusFromStage(stage, rawStatus);
  const emailCell = pickLeadField(row, 'email');
  const email = emailFromCell(emailCell);
  const phone = pickLeadField(row, 'phone');
  const contactName = pickLeadField(row, 'contactName');
  const saleName = pickLeadField(row, 'sale');
  const schoolSize = pickLeadField(row, 'schoolSize');
  const documentStatus = pickLeadField(row, 'documentStatus');
  const remarks = pickLeadField(row, 'remarks');
  const assigned = resolveAssignedUserId(saleName, options.users || [], options.currentUserId);
  const noteParts = [
    pickLeadField(row, 'gradeLevels') ? `ระดับชั้น: ${pickLeadField(row, 'gradeLevels')}` : '',
    schoolSize ? `ขนาดโรงเรียน: ${schoolSize}` : '',
    pickLeadField(row, 'studentCount') ? `จำนวน นร.: ${pickLeadField(row, 'studentCount')}` : '',
    pickLeadField(row, 'upperElementaryStudentCount') ? `จำนวน นร. ป.4-6: ${pickLeadField(row, 'upperElementaryStudentCount')}` : '',
    legacyStep ? `ขั้นตอนเดิม: ${legacyStep}` : '',
    rawStatus && mapStatusLabelToStage(rawStatus) === 'Call' && compactKey(rawStatus) === 'pending' ? 'สถานะเดิม: Pending' : '',
    pickLeadField(row, 'lastContactedAt') ? `ติดต่อล่าสุด: ${excelSerialToDateText(pickLeadField(row, 'lastContactedAt'))}` : '',
    pickLeadField(row, 'nextCallAt') ? `นัดโทรครั้งถัดไป: ${excelSerialToDateText(pickLeadField(row, 'nextCallAt'))}` : '',
    documentStatus ? `Ps/ยื่นหนังสือ: ${documentStatus}` : '',
    remarks ? `Remarks: ${remarks}` : '',
    saleName ? `Sale เดิม: ${saleName}` : '',
    emailCell && !email ? `ข้อมูลช่องอีเมล: ${emailCell}` : '',
  ].filter(Boolean);

  return {
    _id: `l_import_${now.getTime()}_${options.index}`,
    schoolName,
    address: pickLeadField(row, 'address') || [district, province].filter(Boolean).join(' '),
    zone: pickLeadField(row, 'zone') || provinceToZone(province),
    status,
    stage,
    score: scoreFromStage(stage, status),
    gradeLevels: pickLeadField(row, 'gradeLevels') || undefined,
    educationAuthority: pickLeadField(row, 'educationAuthority') || undefined,
    district: district || undefined,
    province: province || undefined,
    studentCount: numberFromImportCell(pickLeadField(row, 'studentCount')),
    upperElementaryStudentCount: numberFromImportCell(pickLeadField(row, 'upperElementaryStudentCount')),
    lastContactedAt: excelSerialToDateText(pickLeadField(row, 'lastContactedAt')) || undefined,
    nextCallAt: excelSerialToDateText(pickLeadField(row, 'nextCallAt')) || undefined,
    documentStatus: documentStatus || undefined,
    remarks: remarks || undefined,
    legacySaleName: assigned.legacySaleName,
    source: pickLeadField(row, 'source') || 'Excel Import',
    campaign: pickLeadField(row, 'campaign') || 'สรุปรายชื่อโรงเรียนกำลังดำเนินการ',
    archived: stage === 'Lost' && String(legacyStep || '').includes('ปิดกิจการ'),
    contacts: phone || email || contactName ? [{
      name: contactName || saleName || 'ผู้ติดต่อจากไฟล์นำเข้า',
      position: emailCell && !email ? emailCell : '',
      phone,
      email,
    }] : [],
    assignedTo: assigned.userId,
    assignmentHistory: [{
      toUserId: assigned.userId,
      changedBy: options.currentUserId,
      reason: 'Excel import',
      changedAt: now,
    }],
    notes: noteParts.length ? [{
      author: 'Excel Import',
      content: noteParts.join('\n'),
      type: 'General',
      createdAt: now,
    }] : [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function collapseImportDrafts(drafts: LeadImportDraft[]): LeadImportDraft[] {
  const merged = new Map<string, LeadImportDraft>();
  for (const draft of drafts) {
    const key = leadIdentityKey(draft);
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, draft);
      continue;
    }
    merged.set(key, {
      ...previous,
      ...Object.fromEntries(
        Object.entries(draft).filter(([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0))
      ),
      _id: previous._id,
      createdAt: previous.createdAt,
      assignmentHistory: previous.assignmentHistory,
      notes: [
        ...(previous.notes || []),
        ...((draft.notes || []).filter(note => !(previous.notes || []).some(existing => existing.content === note.content))),
      ],
    } as LeadImportDraft);
  }
  return [...merged.values()];
}

export function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvText(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map(header => header.trim());
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line);
    return headers.reduce((acc, header, index) => ({ ...acc, [header]: cells[index] || '' }), {} as Record<string, string>);
  });
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function readZipEntry(buffer: Buffer, entryName: string) {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 66000); offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('อ่านโครงสร้างไฟล์ Excel ไม่ได้');

  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirSize = buffer.readUInt32LE(eocdOffset + 12);
  let offset = centralDirOffset;
  const end = centralDirOffset + centralDirSize;

  while (offset < end) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');

    if (fileName === entryName) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return compressed.toString('utf8');
      if (method === 8) return zlib.inflateRawSync(compressed).toString('utf8');
      throw new Error(`ไม่รองรับ compression method ${method} ในไฟล์ Excel`);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error(`ไม่พบ ${entryName} ในไฟล์ Excel`);
}

function parseSharedStrings(xml: string) {
  const strings: string[] = [];
  const siMatches = xml.matchAll(/<si\b[\s\S]*?<\/si>/g);
  for (const match of siMatches) {
    const text = [...match[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map(item => decodeXml(item[1]))
      .join('');
    strings.push(text);
  }
  return strings;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows: Record<string, string>[] = [];
  const rowMatches = xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g);
  for (const rowMatch of rowMatches) {
    const values: Record<string, string> = {};
    const cellMatches = rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g);
    for (const cellMatch of cellMatches) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) continue;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      let value = '';
      if (type === 'inlineStr') {
        value = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(item => decodeXml(item[1])).join('');
      } else {
        const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || '';
        value = type === 's' && rawValue ? sharedStrings[Number(rawValue)] || '' : decodeXml(rawValue);
      }
      values[ref] = value.trim();
    }
    if (Object.values(values).some(Boolean)) rows.push(values);
  }
  return rows;
}

export function parseXlsxRows(buffer: Buffer) {
  let sharedStrings: string[] = [];
  try {
    sharedStrings = parseSharedStrings(readZipEntry(buffer, 'xl/sharedStrings.xml'));
  } catch {
    sharedStrings = [];
  }
  const sheetXml = readZipEntry(buffer, 'xl/worksheets/sheet1.xml');
  const rows = parseWorksheetRows(sheetXml, sharedStrings);
  if (rows.length < 2) return [] as Record<string, string>[];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const mapped: Record<string, string> = {};
    Object.entries(row).forEach(([col, value]) => {
      mapped[`__col_${col}`] = value;
    });
    Object.entries(headers).forEach(([col, header]) => {
      if (!header) return;
      mapped[header] = row[col] || '';
      mapped[header.trim()] = row[col] || '';
    });
    return mapped;
  });
}

export function parseImportBuffer(buffer: Buffer, contentType?: string) {
  const isXlsx = buffer.subarray(0, 2).toString('utf8') === 'PK'
    || String(contentType || '').includes('spreadsheetml');
  if (isXlsx) {
    return { rows: parseXlsxRows(buffer), format: 'xlsx' as const };
  }
  const csvText = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  return { rows: parseCsvText(csvText), format: 'csv' as const };
}
