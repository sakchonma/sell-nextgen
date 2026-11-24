/**
 * Customer groups that share the `leads` collection.
 * Corporate / University leads link to Pipeline, Tasks, Calendar, Quotes, Requests and AI Logger
 * through the same lead _id as schools.
 */
export type LeadSegment = 'school' | 'corporate' | 'university';

export interface ProfileField {
  key: string;
  label: string;
  /** render as a link when the value is a URL */
  kind?: 'text' | 'url' | 'money' | 'bool' | 'date';
}

export interface ProfileSection {
  title: string;
  fields: ProfileField[];
}

export interface SegmentFilterDef {
  key: string;
  label: string;
  /** label shown for boolean facet values */
  trueLabel?: string;
  falseLabel?: string;
}

export interface SegmentConfig {
  segment: LeadSegment;
  path: '/leads' | '/corporate' | '/universities';
  menuLabel: string;
  title: string;
  description: string;
  nameLabel: string;
  namePlaceholder: string;
  addButton: string;
  emptyText: string;
  searchPlaceholder: string;
  filters: SegmentFilterDef[];
  /** short chips shown on each card */
  cardChips: ProfileField[];
  /** one-line "what to do next" shown on each card */
  nextActionKeys: string[];
  sections: ProfileSection[];
  /** fields offered in the "add" modal */
  createFields: ProfileField[];
}

export const SEGMENT_CONFIGS: Record<LeadSegment, SegmentConfig> = {
  school: {
    segment: 'school',
    path: '/leads',
    menuLabel: 'Leads & โรงเรียน',
    title: 'Leads & โรงเรียน',
    description: 'บริหารจัดการข้อมูลโรงเรียนและรายชื่อผู้ติดต่อที่กำลังดูแลเสนอขาย',
    nameLabel: 'ชื่อโรงเรียน',
    namePlaceholder: 'โรงเรียนวิทยาศาสตร์อัจฉริยะ',
    addButton: 'เพิ่มข้อมูลโรงเรียน',
    emptyText: 'ไม่พบข้อมูลโรงเรียนในเงื่อนไขการค้นหา',
    searchPlaceholder: 'ค้นหาชื่อโรงเรียน หรือที่อยู่...',
    filters: [],
    cardChips: [],
    nextActionKeys: [],
    sections: [],
    createFields: [],
  },
  corporate: {
    segment: 'corporate',
    path: '/corporate',
    menuLabel: 'Leads องค์กร',
    title: 'Leads องค์กร (Corporate)',
    description: 'ฐานลูกค้าองค์กรทั่วประเทศ — Orientation บุคลากร / CG Day / Culture Workshop',
    nameLabel: 'ชื่อองค์กร / หน่วยงาน',
    namePlaceholder: 'เช่น บริษัท ตัวอย่าง จำกัด (มหาชน)',
    addButton: 'เพิ่มองค์กร',
    emptyText: 'ไม่พบองค์กรในเงื่อนไขการค้นหา',
    searchPlaceholder: 'ค้นหาชื่อองค์กร รหัส (L01) บริการ กลุ่มงบ ผู้ติดต่อ...',
    filters: [
      { key: 'tier', label: 'เกรด A/B/C' },
      { key: 'orgType', label: 'ประเภทองค์กร' },
      { key: 'region', label: 'ภูมิภาค' },
      { key: 'serviceOffer', label: 'บริการที่ควรเสนอ' },
      { key: 'eventStatus2569', label: 'สถานะงานปี 2569' },
      { key: 'recommendedRound', label: 'รอบขายแนะนำ' },
      { key: 'directProjectEvidence', label: 'หลักฐานโครงการตรง' },
      { key: 'isTop20', label: 'กลุ่มเป้าหมาย', trueLabel: '20 รายชุดแรก', falseLabel: 'ฐานคัดกรอง' },
      { key: 'followerRole', label: 'ผู้ติดตามหลัก (ตามไฟล์)' },
    ],
    cardChips: [
      { key: 'code', label: 'รหัส' },
      { key: 'orgType', label: 'ประเภท' },
      { key: 'serviceOffer', label: 'บริการ' },
      { key: 'eventStatus2569', label: 'สถานะงาน 2569' },
    ],
    nextActionKeys: ['nextTask', 'nextAction'],
    sections: [
      {
        title: 'ภาพรวมบัญชี',
        fields: [
          { key: 'code', label: 'รหัสบัญชี' },
          { key: 'tier', label: 'เกรด (A/B/C)' },
          { key: 'isTop20', label: '20 รายชุดแรก', kind: 'bool' },
          { key: 'orgType', label: 'ประเภทองค์กร' },
          { key: 'region', label: 'ภูมิภาค' },
          { key: 'locationNote', label: 'สถานะที่ตั้ง' },
          { key: 'budgetGroup', label: 'กลุ่มงบที่ต้องตรวจ' },
          { key: 'serviceOffer', label: 'บริการที่ควรเสนอ' },
          { key: 'initialOffer', label: 'ข้อเสนอเริ่มต้น' },
          { key: 'targetRole', label: 'บทบาทที่ควรสอบถาม' },
          { key: 'approach', label: 'ทางเข้าหา' },
        ],
      },
      {
        title: 'เงื่อนไขซื้อ 4 เรื่อง (ครบ = เกรด A)',
        fields: [
          { key: 'directProjectEvidence', label: 'หลักฐานโครงการตรง' },
          { key: 'confirmedNeed', label: 'โจทย์ยืนยัน' },
          { key: 'confirmedOwner', label: 'เจ้าของโครงการยืนยัน' },
          { key: 'confirmedWithin6Months', label: 'จัดภายใน 6 เดือนยืนยัน' },
          { key: 'confirmedBudget', label: 'งบและวิธีซื้อยืนยัน' },
        ],
      },
      {
        title: 'สถานะกิจกรรม / จัดซื้อ',
        fields: [
          { key: 'activityKind', label: 'ลักษณะกิจกรรม' },
          { key: 'eventStatus2569', label: 'สถานะงานปี 2569' },
          { key: 'dealEventStatus', label: 'สถานะงาน (ชีทติดตามดีล)' },
          { key: 'confirmedEventDate', label: 'วันจัดที่ยืนยัน', kind: 'date' },
          { key: 'newsDate', label: 'วันเผยแพร่ข่าว', kind: 'date' },
          { key: 'procurementStatus', label: 'สถานะจัดซื้อ' },
          { key: 'dealProcurementStatus', label: 'สถานะจัดซื้อ (ชีทติดตามดีล)' },
          { key: 'recommendedRound', label: 'รอบขายแนะนำ' },
          { key: 'statusEvidenceLevel', label: 'ระดับหลักฐานสถานะ' },
        ],
      },
      {
        title: 'ติดตามดีล',
        fields: [
          { key: 'followerRole', label: 'ผู้ติดตามหลัก (ตามไฟล์)' },
          { key: 'dealStep', label: 'ขั้นตอน (ตามไฟล์)' },
          { key: 'nextTask', label: 'งานถัดไป' },
          { key: 'nextAction', label: 'สิ่งที่ทีมขายควรทำต่อ' },
          { key: 'followupFromStatus', label: 'งานต่อจากสถานะกิจกรรม' },
          { key: 'needOrConfirmedDate', label: 'โจทย์ / วันจัดที่ยืนยัน' },
          { key: 'buyerChannel', label: 'ผู้ซื้อ / ช่องทางยืนยัน' },
          { key: 'infoToAsk', label: 'ข้อมูลที่ต้องถามเพิ่ม' },
          { key: 'toVerify', label: 'สิ่งที่ต้องตรวจเพิ่ม' },
          { key: 'proposedValue', label: 'มูลค่าเสนอ (บาท)', kind: 'money' },
          { key: 'expectedDecision', label: 'คาดตัดสินใจ' },
          { key: 'contractValue', label: 'มูลค่าสัญญายืนยัน (บาท)', kind: 'money' },
          { key: 'receivedAmount', label: 'เงินรับจริง (บาท)', kind: 'money' },
          { key: 'lostReason', label: 'เหตุผลแพ้ / เลื่อน' },
          { key: 'lastContactResult', label: 'ผลติดต่อล่าสุด' },
        ],
      },
      {
        title: 'หลักฐานและแหล่งข้อมูล',
        fields: [
          { key: 'evidence', label: 'หลักฐานที่พบ' },
          { key: 'evidenceYear', label: 'ปีของหลักฐาน (พ.ศ.)' },
          { key: 'evidenceYearBasis', label: 'ฐานปีของหลักฐาน' },
          { key: 'checkScope', label: 'ขอบเขตที่ตรวจ' },
          { key: 'centralContact', label: 'เบอร์กลาง / ทางเข้าหา' },
          { key: 'officialChannelUrl', label: 'ช่องทางกลางทางการ', kind: 'url' },
          { key: 'contactUrl', label: 'URL ช่องทางติดต่อ', kind: 'url' },
          { key: 'evidenceUrl', label: 'URL หลักฐาน', kind: 'url' },
          { key: 'statusUrl', label: 'URL ยืนยันสถานะ', kind: 'url' },
          { key: 'checkedAt', label: 'ตรวจข้อมูลเมื่อ', kind: 'date' },
          { key: 'reviewedAt', label: 'วันที่ทบทวน', kind: 'date' },
        ],
      },
    ],
    createFields: [
      { key: 'orgType', label: 'ประเภทองค์กร' },
      { key: 'serviceOffer', label: 'บริการที่ควรเสนอ' },
      { key: 'targetRole', label: 'บทบาทที่ควรสอบถาม' },
      { key: 'tier', label: 'เกรด (A/B/C)' },
    ],
  },
  university: {
    segment: 'university',
    path: '/universities',
    menuLabel: 'Leads มหาวิทยาลัย',
    title: 'Leads มหาวิทยาลัย (คณะ / วิทยาลัย)',
    description: 'คณะเป้าหมายสำหรับรับน้อง–ปฐมนิเทศ BEYOND FIRST MEET: FROM STRANGERS TO SYNERGY',
    nameLabel: 'คณะ / วิทยาลัย + มหาวิทยาลัย',
    namePlaceholder: 'เช่น คณะวิศวกรรมศาสตร์ มหาวิทยาลัยตัวอย่าง',
    addButton: 'เพิ่มคณะ',
    emptyText: 'ไม่พบคณะในเงื่อนไขการค้นหา',
    searchPlaceholder: 'ค้นหาคณะ มหาวิทยาลัย รหัส (FAC-001) พื้นที่ ผู้ติดต่อ...',
    filters: [
      { key: 'university', label: 'มหาวิทยาลัย' },
      { key: 'institutionType', label: 'ประเภท (รัฐ/เอกชน)' },
      { key: 'tier', label: 'ระดับหลักฐาน' },
      { key: 'contactStatus', label: 'สถานะติดต่อ' },
      { key: 'newBudgetStatus', label: 'สถานะงบรอบใหม่' },
      { key: 'startFirst', label: 'กลุ่มเริ่มต้น', trueLabel: 'เริ่มเจาะ 5 คณะแรก', falseLabel: 'คณะอื่น' },
    ],
    cardChips: [
      { key: 'facultyCode', label: 'รหัส' },
      { key: 'institutionType', label: 'ประเภท' },
      { key: 'contactStatus', label: 'สถานะติดต่อ' },
      { key: 'pastBudget', label: 'งบย้อนหลัง', kind: 'money' },
    ],
    nextActionKeys: ['nextTask', 'firstQuestion'],
    sections: [
      {
        title: 'ภาพรวมคณะ',
        fields: [
          { key: 'facultyCode', label: 'รหัสคณะ' },
          { key: 'approachOrder', label: 'ลำดับเข้าหาเสนอ' },
          { key: 'startFirst', label: 'อยู่ใน 5 คณะแรก', kind: 'bool' },
          { key: 'faculty', label: 'คณะ / วิทยาลัย' },
          { key: 'university', label: 'มหาวิทยาลัย' },
          { key: 'institutionType', label: 'ประเภท' },
          { key: 'meetingArea', label: 'พื้นที่นัดหมาย' },
          { key: 'tier', label: 'ระดับหลักฐาน' },
          { key: 'selectionReason', label: 'เหตุผลคัดเข้าหา' },
          { key: 'startFirstReason', label: 'เหตุผลที่เริ่มก่อน' },
        ],
      },
      {
        title: 'งบประมาณ',
        fields: [
          { key: 'pastBudget', label: 'งบปฐมนิเทศย้อนหลัง (บาท)', kind: 'money' },
          { key: 'pastBudgetText', label: 'งบย้อนหลัง / สถานะ' },
          { key: 'fiscalYear', label: 'ปีงบประมาณ' },
          { key: 'newBudgetStatus', label: 'สถานะงบรอบใหม่' },
          { key: 'newBudgetStatusDetail', label: 'รายละเอียดงบรอบใหม่' },
          { key: 'confirmedNewBudget', label: 'งบรอบใหม่ยืนยัน (บาท)', kind: 'money' },
          { key: 'purchaseMethod', label: 'วิธีซื้อ / งบร่วม' },
        ],
      },
      {
        title: 'ติดต่อและฟังเสียง',
        fields: [
          { key: 'contactStatus', label: 'สถานะติดต่อ' },
          { key: 'followUpDate', label: 'กำหนดติดตาม', kind: 'date' },
          { key: 'nextTask', label: 'งานถัดไป' },
          { key: 'targetRole', label: 'ผู้ที่ควรขอคุย' },
          { key: 'confirmedBuyer', label: 'ผู้ซื้อ / ผู้อนุมัติ' },
          { key: 'phoneRaw', label: 'โทรศัพท์จากเว็บ' },
          { key: 'emailRaw', label: 'อีเมลจากเว็บ' },
          { key: 'channelScope', label: 'ขอบเขตช่องทาง' },
          { key: 'firstQuestion', label: 'คำถามแรก' },
          { key: 'openQuestion', label: 'คำถามเปิดฟังเสียงคณะ' },
          { key: 'painQuestion', label: 'คำถามเจาะปัญหา / ผลลัพธ์' },
          { key: 'budgetQuestion', label: 'คำถามงบ / ผู้อนุมัติ / วิธีซื้อ' },
          { key: 'realVoice', label: 'เสียงจากคณะ' },
          { key: 'confirmedDecisionDate', label: 'วันที่ตัดสินใจยืนยัน', kind: 'date' },
          { key: 'confirmedEventDate', label: 'วันจัดยืนยัน', kind: 'date' },
          { key: 'limitation', label: 'ข้อจำกัด / จุดต้องตรวจสอบ' },
        ],
      },
      {
        title: 'ข้อเสนอ BEYOND FIRST MEET',
        fields: [
          { key: 'activityEvidence', label: 'กิจกรรม / หลักฐานที่พบ' },
          { key: 'evidenceYear', label: 'ปีหลักฐาน / วันจัด' },
          { key: 'facultyVoice', label: 'เสียงคณะที่เผยแพร่ (สรุป)' },
          { key: 'pitchAngle', label: 'มุมเสนอ' },
          { key: 'insight', label: 'Insight ที่ควรคุย' },
          { key: 'evidenceLimit', label: 'ข้อจำกัดหลักฐาน' },
          { key: 'nextRound', label: 'รอบกิจกรรมถัดไป' },
        ],
      },
      {
        title: 'แหล่งข้อมูล',
        fields: [
          { key: 'activityUrl', label: 'URL กิจกรรม / งบ', kind: 'url' },
          { key: 'supportUrl', label: 'URL ประกอบ', kind: 'url' },
          { key: 'contactUrl', label: 'URL ช่องทางติดต่อ', kind: 'url' },
          { key: 'webCheckedAt', label: 'วันที่ตรวจเว็บ', kind: 'date' },
        ],
      },
    ],
    createFields: [
      { key: 'faculty', label: 'คณะ / วิทยาลัย' },
      { key: 'university', label: 'มหาวิทยาลัย' },
      { key: 'institutionType', label: 'ประเภท (รัฐ/เอกชน)' },
      { key: 'targetRole', label: 'ผู้ที่ควรขอคุย' },
    ],
  },
};

export function normalizeSegment(value: unknown): LeadSegment {
  return value === 'corporate' || value === 'university' ? value : 'school';
}

export function segmentConfigForLead(lead: { segment?: unknown } | null | undefined) {
  return SEGMENT_CONFIGS[normalizeSegment(lead?.segment)];
}

export function formatProfileValue(value: unknown, kind: ProfileField['kind'] = 'text'): string {
  if (value === null || value === undefined || value === '') return '';
  if (kind === 'bool' || typeof value === 'boolean') return value === true || value === 'true' ? 'ใช่' : 'ไม่ใช่';
  if (kind === 'money' && Number.isFinite(Number(value))) return `${Number(value).toLocaleString('th-TH')} บาท`;
  if (kind === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return String(value);
}

export function facetLabel(filter: SegmentFilterDef, value: string) {
  if (value === 'true') return filter.trueLabel || 'ใช่';
  if (value === 'false') return filter.falseLabel || 'ไม่ใช่';
  return value;
}

export function isUrl(value: unknown) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}
