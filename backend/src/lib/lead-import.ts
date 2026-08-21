import zlib from 'zlib';
import {
  isSalesFunnelStage,
  normalizeLeadStage,
  scoreFromStage as scoreForFunnelStage,
  temperatureFromStage,
  type SalesFunnelStage,
} from '../config/sales-funnel-stages.js';
import type { Lead } from '../types/index.js';

export type LeadStatus = Lead['status'];
export type LeadImportDraft = Lead;

export interface ImportUser {
  _id: string;
  name: string;
  roleId?: string;
  email?: string;
}

export const SALE_NICKNAME_MAP: Record<string, string> = {
  พิมพ์: 'พิมพ์สุดา พิทักษ์วงค์',
  ยิ้ม: 'วีรินท์รดา พูนสวัสดิ์',
  พี่เกรซ: 'root',
};

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
  contactName: ['contactName', 'ผู้ติดต่อ', '__col_R'],
  documentStatus: ['documentStatus', 'Ps / ยื่นหนังสือ /Trial', 'Ps / ยื่นหนังสือ', '__col_P'],
  remarks: ['remarks', 'Remarks', '__col_Q'],
  sale: ['legacySaleName', 'Sale', 'sale', '__col_S'],
  zone: ['zone'],
  source: ['source'],
  campaign: ['campaign'],
  address: ['address'],
};

const STATUS_TO_STAGE: Record<string, SalesFunnelStage> = {
  call: 'Called',
  called: 'Called',
  'callแล้ว': 'Called',
  meeting: 'Appointed',
  appointed: 'Appointed',
  นัดหมาย: 'Appointed',
  นัดหมายแล้ว: 'Appointed',
  presentation: 'Presented',
  present: 'Presented',
  presented: 'Presented',
  demoworkshop: 'DemoWorkshop',
  'demo/workshop': 'DemoWorkshop',
  documentsent: 'DocumentSent',
  ส่งเอกสารแล้ว: 'DocumentSent',
  targetschool: 'TargetSchool',
  quotation: 'Quotation',
  won: 'Won',
  lost: 'Lost',
};

const STEP_TO_STAGE: Record<string, SalesFunnelStage> = {
  รอยื่นหนังสือ: 'Called',
  ไม่มีคนรับสายติดต่อซ้ำ: 'Called',
  'รร.จะติดต่อกลับมา': 'DocumentSent',
  ยื่นหนังสือติดตามผล: 'DocumentSent',
  โทรติดตามซ้ำ: 'DocumentSent',
  ยื่นหนังสือ: 'DocumentSent',
  present: 'Presented',
  presentation: 'Presented',
  presented: 'Presented',
  'ผอ.ไม่สนใจ': 'Lost',
  ปิดกิจการ: 'Lost',
  นัดหมาย: 'Appointed',
  นัดหมายแล้ว: 'Appointed',
  call: 'Called',
  called: 'Called',
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
  if (!value.trim()) return 'TargetSchool';
  if (value.includes('ปิดกิจการ') || value.includes('ไม่สนใจ') || value.includes('closed lost') || value.includes('lost')) return 'Lost';
  if (value.includes('won') || value.includes('ปิดการขาย')) return 'Won';
  if (value.includes('trial') || value.includes('pilot') || value.includes('ทดลอง') || value.includes('proposal') || value.includes('เสนอราคา') || value.includes('quotation')) return 'Quotation';
  if (value.includes('demo') || value.includes('workshop') || value.includes('สาธิต')) return 'DemoWorkshop';
  if (value.includes('present') || value.includes('พรีเซน')) return 'Presented';
  if (value.includes('นัด') || value.includes('meeting') || value.includes('appointed')) return 'Appointed';
  if (value.includes('ไม่มีคนรับสาย') || value.includes('รอยื่น')) return 'Called';
  if (value.includes('ติดต่อกลับ') || value.includes('ยื่นหนังสือ') || value.includes('โทรติดตาม')) return 'DocumentSent';
  if (value.includes('โทร') || value.includes('call') || value.includes('called')) return 'Called';
  if (value.includes('เอกสาร') || value.includes('email') || value.includes('อีเมล')) return 'DocumentSent';
  return 'TargetSchool';
}

export function resolveImportStage(status?: string, step?: string): SalesFunnelStage {
  const stepValue = String(step || '').trim();
  if (stepValue) {
    if (isSalesFunnelStage(stepValue)) return stepValue;
    return mapLegacyStepToLeadStage(stepValue);
  }
  const statusValue = String(status || '').trim();
  if (!statusValue) return 'TargetSchool';
  if (isSalesFunnelStage(statusValue)) return statusValue;
  return mapLegacyStepToLeadStage(statusValue);
}

export function statusFromStage(stage: SalesFunnelStage, _rawStatus?: string): LeadStatus {
  return temperatureFromStage(stage);
}

export function scoreFromStage(stage: SalesFunnelStage, _status?: LeadStatus): number {
  return scoreForFunnelStage(stage);
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

export function parseFlexibleThaiDate(token: string, fallbackYear = 2026): string | undefined {
  const match = String(token).trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : fallbackYear;
  if (year < 100) {
    year = year >= 50 ? year + 2500 - 543 : year + 2000;
  } else if (year >= 2400) {
    year -= 543;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return date.toISOString().slice(0, 10);
}

export function splitRemarkLogs(raw?: string, author?: string, createdAt?: Date) {
  const text = String(raw || '').trim();
  if (!text) return [] as Array<{ content: string; author?: string; createdAt: Date }>;
  const stamp = createdAt || new Date();
  return text.split(/\s*(?:->|→)\s*/).map(part => part.trim()).filter(Boolean).map(content => ({
    content,
    author: author || 'Excel Import',
    createdAt: stamp,
  }));
}

export function leadIdentityKey(lead: { schoolName?: string; district?: string; province?: string }) {
  return [compactKey(lead.schoolName), compactKey(lead.district), compactKey(lead.province)].join('|');
}

export function resolveAssignedUserId(saleName: string | undefined, users: ImportUser[], fallbackId: string) {
  const raw = String(saleName || '').trim();
  if (!raw) return { userId: fallbackId, legacySaleName: undefined as string | undefined };

  const mapped = SALE_NICKNAME_MAP[raw] || raw;
  const needle = compactKey(mapped);
  const matched = users.find(user => {
    if (mapped === 'root') {
      return user._id === 'root' || compactKey(user.email).startsWith('root@') || compactKey(user.name).includes('root');
    }
    const nameKey = compactKey(user.name);
    return nameKey === needle || nameKey.includes(needle) || needle.includes(nameKey);
  }) || users.find(user => compactKey(user.name) === compactKey(raw));

  if (matched) {
    return { userId: matched._id, legacySaleName: matched.name };
  }
  return { userId: fallbackId, legacySaleName: mapped === 'root' ? 'root' : mapped };
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
  const extraRemarks = pickLeadField(row, 'contactName');
  const saleName = pickLeadField(row, 'sale');
  const schoolSize = pickLeadField(row, 'schoolSize');
  const remarks = pickLeadField(row, 'remarks');
  const assigned = resolveAssignedUserId(saleName, options.users || [], options.currentUserId);
  const lastContactedAt = excelSerialToDateText(pickLeadField(row, 'lastContactedAt')) || undefined;
  const nextCallAt = excelSerialToDateText(pickLeadField(row, 'nextCallAt')) || undefined;
  const remarkLogs = [
    ...splitRemarkLogs(remarks, assigned.legacySaleName || 'Excel Import', now),
    ...splitRemarkLogs(extraRemarks, assigned.legacySaleName || 'Excel Import', now),
  ];
  const noteParts = [
    schoolSize ? `ขนาดโรงเรียน: ${schoolSize}` : '',
    legacyStep ? `ขั้นตอนเดิม: ${legacyStep}` : '',
    lastContactedAt ? `ติดต่อล่าสุด (คอลัมน์ L): ${lastContactedAt}` : '',
    nextCallAt ? `นัดโทรครั้งถัดไป (คอลัมน์ M): ${nextCallAt}` : '',
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
    lastContactedAt,
    nextCallAt,
    schoolSize: schoolSize || undefined,
    originalStep: legacyStep || undefined,
    remarks: remarks || undefined,
    remarkLogs,
    legacySaleName: assigned.legacySaleName,
    source: pickLeadField(row, 'source') || 'Excel Import',
    campaign: pickLeadField(row, 'campaign') || 'สรุปรายชื่อโรงเรียนกำลังดำเนินการ',
    archived: stage === 'Lost' && String(legacyStep || '').includes('ปิดกิจการ'),
    contacts: phone || email ? [{
      name: 'ผู้ติดต่อจากไฟล์นำเข้า',
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
      remarkLogs: [
        ...(previous.remarkLogs || []),
        ...((draft.remarkLogs || []).filter(item => !(previous.remarkLogs || []).some(existing => existing.content === item.content))),
      ],
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
