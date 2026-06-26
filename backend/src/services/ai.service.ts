import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';

const genAI = config.gemini.apiKey ? new GoogleGenerativeAI(config.gemini.apiKey) : null;

export type ConversationalTaskType = 'Call' | 'Meeting' | 'Demo' | 'FollowUp' | 'Other';
export type UrgencyLevel = 'Low' | 'Medium' | 'High';

export interface ParsedConversationalLog {
  title: string;
  type: ConversationalTaskType;
  dateStr: string;
  timeStr: string;
  schoolMentioned?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  urgency: UrgencyLevel;
  notes: string;
  confidence: number;
  missingFields: string[];
}

const TASK_TYPES: ConversationalTaskType[] = ['Call', 'Meeting', 'Demo', 'FollowUp', 'Other'];
const URGENCY_LEVELS: UrgencyLevel[] = ['Low', 'Medium', 'High'];

function cleanAndParseJSON(text: string) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch {
    console.error('Failed to parse AI JSON response:', text);
    return null;
  }
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseThaiNumber(value?: string): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) return Number(normalized);

  const thaiNumberMap: Record<string, number> = {
    หนึ่ง: 1,
    นึง: 1,
    เอ็ด: 1,
    สอง: 2,
    สาม: 3,
    สี่: 4,
    ห้า: 5,
    หก: 6,
    เจ็ด: 7,
    แปด: 8,
    เก้า: 9,
    สิบ: 10,
    สิบเอ็ด: 11,
    สิบสอง: 12
  };

  return thaiNumberMap[normalized] ?? null;
}

function inferTaskType(text: string): ConversationalTaskType {
  if (/สาธิต|เดโม|demo/i.test(text)) return 'Demo';
  if (/ติดตาม|follow.?up|ตามใบเสนอราคา|ตามงาน/i.test(text)) return 'FollowUp';
  if (/โทร|call|ติดต่อกลับ/i.test(text)) return 'Call';
  if (/ประชุม|นัด|พบ|เข้าพบ|กินข้าว|คุยกับ/i.test(text)) return 'Meeting';
  return 'Other';
}

function inferUrgency(text: string, dateStr: string): UrgencyLevel {
  const todayStr = formatLocalDate(new Date());
  if (/ด่วน|เร่ง|สำคัญ|ภายในวันนี้|วันนี้|พรุ่งนี้/.test(text)) return 'High';
  if (dateStr === todayStr) return 'High';
  if (/สัปดาห์หน้า|เดือนหน้า|เมื่อสะดวก|ไม่รีบ/.test(text)) return 'Low';
  return 'Medium';
}

function inferDate(text: string): { dateStr: string; found: boolean } {
  const explicitDate = text.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (explicitDate) {
    return {
      dateStr: `${explicitDate[1]}-${explicitDate[2].padStart(2, '0')}-${explicitDate[3].padStart(2, '0')}`,
      found: true
    };
  }

  const thaiDate = text.match(/(\d{1,2})[/-](\d{1,2})[/-](25\d{2}|20\d{2})/);
  if (thaiDate) {
    const year = Number(thaiDate[3]) > 2400 ? Number(thaiDate[3]) - 543 : Number(thaiDate[3]);
    return {
      dateStr: `${year}-${thaiDate[2].padStart(2, '0')}-${thaiDate[1].padStart(2, '0')}`,
      found: true
    };
  }

  const base = new Date();
  base.setHours(12, 0, 0, 0);

  if (/มะรืน|อีกสองวัน/.test(text)) {
    base.setDate(base.getDate() + 2);
    return { dateStr: formatLocalDate(base), found: true };
  }

  if (/พรุ่งนี้|วันรุ่งขึ้น/.test(text)) {
    base.setDate(base.getDate() + 1);
    return { dateStr: formatLocalDate(base), found: true };
  }

  if (/วันนี้|เย็นนี้|บ่ายนี้|เช้านี้/.test(text)) {
    return { dateStr: formatLocalDate(base), found: true };
  }

  const weekdays = [
    { terms: ['อาทิตย์', 'วันอาทิตย์'], day: 0 },
    { terms: ['จันทร์', 'วันจันทร์'], day: 1 },
    { terms: ['อังคาร', 'วันอังคาร'], day: 2 },
    { terms: ['พุธ', 'วันพุธ'], day: 3 },
    { terms: ['พฤหัส', 'พฤหัสบดี', 'วันพฤหัสบดี'], day: 4 },
    { terms: ['ศุกร์', 'วันศุกร์'], day: 5 },
    { terms: ['เสาร์', 'วันเสาร์'], day: 6 }
  ];

  const matchedWeekday = weekdays.find(({ terms }) => terms.some(term => text.includes(term)));
  if (matchedWeekday) {
    const today = base.getDay();
    let delta = matchedWeekday.day - today;
    if (delta < 0) delta += 7;
    if (/หน้า/.test(text) && delta <= 1) delta += 7;
    if (delta === 0 && !/วันนี้|นี้/.test(text)) delta = 7;
    base.setDate(base.getDate() + delta);
    return { dateStr: formatLocalDate(base), found: true };
  }

  return { dateStr: formatLocalDate(base), found: false };
}

function inferTime(text: string): { timeStr: string; found: boolean } {
  const explicitTime = text.match(/(\d{1,2})[:.](\d{2})/);
  if (explicitTime) {
    return {
      timeStr: `${explicitTime[1].padStart(2, '0')}:${explicitTime[2]}`,
      found: true
    };
  }

  if (/เที่ยงครึ่ง/.test(text)) return { timeStr: '12:30', found: true };
  if (/เที่ยง/.test(text)) return { timeStr: '12:00', found: true };

  const numberToken = '(\\d{1,2}|หนึ่ง|นึง|เอ็ด|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|สิบเอ็ด|สิบสอง)';
  const afternoonMatch = text.match(new RegExp(`บ่าย\\s*${numberToken}`));
  const generalMatch = text.match(new RegExp(`${numberToken}\\s*(โมง|นาฬิกา)`));

  let hour: number | null = null;
  if (afternoonMatch) {
    hour = parseThaiNumber(afternoonMatch[1]);
    if (hour !== null) {
      if (hour === 1) hour = 13;
      else if (hour < 12) hour += 12;
    }
  } else if (generalMatch) {
    hour = parseThaiNumber(generalMatch[1]);
    if (hour !== null) {
      if (/บ่าย/.test(text) && hour < 12) hour += 12;
      if (/เย็น|ค่ำ/.test(text) && hour < 12) hour += 12;
      if (/เช้า/.test(text) && hour === 12) hour = 0;
    }
  }

  if (hour !== null && Number.isFinite(hour)) {
    const minute = /ครึ่ง/.test(text) ? 30 : 0;
    return {
      timeStr: `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`,
      found: true
    };
  }

  if (/เช้า/.test(text)) return { timeStr: '09:00', found: true };
  if (/บ่าย/.test(text)) return { timeStr: '13:00', found: true };
  if (/เย็น/.test(text)) return { timeStr: '17:00', found: true };

  return { timeStr: '13:00', found: false };
}

function inferSchool(text: string): string | undefined {
  const schoolMatch = text.match(/โรงเรียน\s*([^,，\n]+?)(?=\s*(?:วัน|พรุ่งนี้|วันนี้|มะรืน|เพื่อ|เรื่อง|ตอน|เวลา|บ่าย|เช้า|เย็น|โทร|$))/);
  if (!schoolMatch) return undefined;
  const schoolName = normalizeWhitespace(schoolMatch[1] || '');
  return schoolName ? `โรงเรียน${schoolName}` : undefined;
}

function inferContactName(text: string): string | undefined {
  const contactMatch = text.match(/(ครู|อาจารย์|คุณ|ผอ\.?|ผู้อำนวยการ)\s*([ก-๙A-Za-z]+)/);
  if (!contactMatch) return undefined;
  return `${contactMatch[1]}${contactMatch[2]}`;
}

function inferContactPhone(text: string): string | undefined {
  return text.match(/0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}/)?.[0];
}

function inferContactEmail(text: string): string | undefined {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function titleFromText(text: string, type: ConversationalTaskType, schoolMentioned?: string, contactName?: string): string {
  const typeLabel: Record<ConversationalTaskType, string> = {
    Call: 'โทรติดต่อลูกค้า',
    Meeting: 'นัดหมายลูกค้า',
    Demo: 'สาธิตระบบ',
    FollowUp: 'ติดตามงานขาย',
    Other: 'บันทึกกิจกรรม'
  };
  const target = schoolMentioned || contactName;
  if (target) return `${typeLabel[type]} - ${target}`.slice(0, 90);
  return `${typeLabel[type]} - ${normalizeWhitespace(text).slice(0, 60)}`;
}

function buildFallbackParsedLog(text: string): ParsedConversationalLog {
  const cleanedText = normalizeWhitespace(text);
  const date = inferDate(cleanedText);
  const time = inferTime(cleanedText);
  const type = inferTaskType(cleanedText);
  const schoolMentioned = inferSchool(cleanedText);
  const contactName = inferContactName(cleanedText);
  const urgency = inferUrgency(cleanedText, date.dateStr);
  const missingFields = [
    !date.found ? 'dateStr' : '',
    !time.found ? 'timeStr' : '',
    !schoolMentioned ? 'schoolMentioned' : ''
  ].filter(Boolean);

  return {
    title: titleFromText(cleanedText, type, schoolMentioned, contactName),
    type,
    dateStr: date.dateStr,
    timeStr: time.timeStr,
    schoolMentioned,
    contactName,
    contactPhone: inferContactPhone(cleanedText),
    contactEmail: inferContactEmail(cleanedText),
    urgency,
    notes: cleanedText,
    confidence: missingFields.length === 0 ? 0.68 : 0.52,
    missingFields
  };
}

function normalizeParsedLog(parsed: any, fallback: ParsedConversationalLog): ParsedConversationalLog {
  const type = TASK_TYPES.includes(parsed?.type) ? parsed.type : fallback.type;
  const urgency = URGENCY_LEVELS.includes(parsed?.urgency) ? parsed.urgency : fallback.urgency;
  const dateStr = typeof parsed?.dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dateStr)
    ? parsed.dateStr
    : fallback.dateStr;
  const timeStr = typeof parsed?.timeStr === 'string' && /^\d{2}:\d{2}$/.test(parsed.timeStr)
    ? parsed.timeStr
    : fallback.timeStr;

  return {
    title: normalizeWhitespace(parsed?.title || fallback.title),
    type,
    dateStr,
    timeStr,
    schoolMentioned: normalizeWhitespace(parsed?.schoolMentioned || fallback.schoolMentioned || '') || undefined,
    contactName: normalizeWhitespace(parsed?.contactName || fallback.contactName || '') || undefined,
    contactPhone: normalizeWhitespace(parsed?.contactPhone || fallback.contactPhone || '') || undefined,
    contactEmail: normalizeWhitespace(parsed?.contactEmail || fallback.contactEmail || '') || undefined,
    urgency,
    notes: normalizeWhitespace(parsed?.notes || fallback.notes),
    confidence: Math.max(0, Math.min(1, Number(parsed?.confidence ?? fallback.confidence))),
    missingFields: Array.isArray(parsed?.missingFields) ? parsed.missingFields : fallback.missingFields
  };
}

/**
 * Generate AI Coach suggestions for a specific school (Lead)
 */
export async function getAICoachSuggestions(lead: any): Promise<string[]> {
  if (!genAI) {
    return [
      'โรงเรียนนี้น่าสนใจ: ควรจัดอบรมเทรนนิ่ง Coding ให้คุณครูก่อนเข้าเสนอสินค้า',
      'กลยุทธ์แนะนำ: นำเสนอสื่อแบบ Robotics Kit พร้อมส่วนลดจัดงานสาธิตแบบ Onsite',
      'ข้อเฝ้าระวัง: ตรวจสอบตารางการใช้งบประมาณไตรมาส 3 ของโรงเรียนเพื่อทำเรื่องเบิกด่วน'
    ];
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
    });

    const prompt = `
      คุณคือโค้ชผู้เชี่ยวชาญด้านการขายหลักสูตรและเทคโนโลยีทางการศึกษา (Sales AI Coach).
      โปรดวิเคราะห์ข้อมูลโรงเรียน (Lead) ต่อไปนี้ และสร้างคำแนะนำหรือกลยุทธ์การขายภาษาไทย 3 ข้อที่เป็นรูปธรรมและปฏิบัติได้จริง.

      ข้อมูลโรงเรียน:
      - ชื่อโรงเรียน: ${lead.schoolName}
      - พื้นที่รับผิดชอบ (Zone): ${lead.zone}
      - ระดับความสนใจ: ${lead.status} (คะแนนความชอบ: ${lead.score}/100)
      - ข้อมูลติดต่อผู้ติดต่อ: ${JSON.stringify(lead.contacts)}
      - บันทึกการเจรจาล่าสุด (Notes): ${JSON.stringify(lead.notes)}

      ข้อกำหนดผลลัพธ์:
      - ส่งกลับเป็นข้อความภาษาไทย จำนวน 3 ข้อ เท่านั้น.
      - ให้คำแนะนำที่ตรงเป้าและสามารถนำไปพูดคุยหรือเตรียมข้อเสนอต่อยอดได้จริง.
      - ส่งข้อมูลออกเป็น JSON Array ของสตริง (เช่น ["ข้อ 1", "ข้อ 2", "ข้อ 3"]) เท่านั้น และไม่ต้องใส่ Markdown code blocks.
    `;

    const result = await model.generateContent(prompt);
    const parsed = cleanAndParseJSON(result.response.text());
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [result.response.text().trim()];
  } catch (error: any) {
    console.error('[ai-service]: Failed to generate AI Coach advice:', error);
    return [
      'ล้มเหลวในการเชื่อมต่อระบบ AI: โปรดตรวจสอบคีย์ Gemini ในไฟล์ .env',
      'กลยุทธ์แนะนำ: นำเสนอสื่อแบบ Robotics Kit พร้อมส่วนลดจัดงานสาธิตแบบ Onsite',
      'ข้อเฝ้าระวัง: ตรวจสอบตารางการใช้งบประมาณไตรมาส 3 ของโรงเรียนเพื่อทำเรื่องเบิกด่วน'
    ];
  }
}

/**
 * Parse conversational log input into structured task data.
 */
export async function parseConversationalLog(text: string): Promise<ParsedConversationalLog> {
  const fallback = buildFallbackParsedLog(text);

  if (!genAI) {
    return fallback;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const now = new Date();
    const prompt = `
      คุณคือเลขาอัจฉริยะฝ่ายขาย (AI Sales Assistant) สำหรับระบบ NEXTGEN Sale & Support.
      วันนี้คือวัน: ${formatLocalDate(now)} (${now.toLocaleDateString('th-TH', { weekday: 'long' })}).

      จงอ่านข้อความภาษาธรรมชาติของฝ่ายขาย แล้วแปลงเป็น JSON สำหรับสร้างงานในปฏิทิน.

      ข้อความ:
      "${text}"

      ส่งกลับเป็น JSON object เท่านั้น โดยใช้ schema นี้:
      {
        "title": "หัวข้องานสั้น กระชับ ภาษาไทย",
        "type": "Call | Meeting | Demo | FollowUp | Other",
        "dateStr": "YYYY-MM-DD",
        "timeStr": "HH:MM",
        "schoolMentioned": "ชื่อโรงเรียน ถ้ามี",
        "contactName": "ชื่อผู้ติดต่อ ถ้ามี",
        "contactPhone": "เบอร์โทร ถ้ามี",
        "contactEmail": "อีเมล ถ้ามี",
        "urgency": "Low | Medium | High",
        "notes": "สรุปรายละเอียดสำคัญจากข้อความ",
        "confidence": 0.0 ถึง 1.0,
        "missingFields": ["ชื่อฟิลด์ที่ยังไม่แน่ใจ เช่น dateStr, timeStr, schoolMentioned"]
      }

      กติกา:
      - ถ้ามีคำว่า "วันนี้", "พรุ่งนี้", "วันศุกร์นี้", "วันพุธหน้า" ให้คำนวณวันที่จากวันนี้.
      - ถ้าไม่มีเวลา ให้ใช้ "13:00" และใส่ "timeStr" ใน missingFields.
      - ถ้าไม่มีวันที่ ให้ใช้วันที่วันนี้ และใส่ "dateStr" ใน missingFields.
      - ห้ามส่ง Markdown code block.
    `;

    const result = await model.generateContent(prompt);
    const parsed = cleanAndParseJSON(result.response.text());
    if (parsed) {
      return normalizeParsedLog(parsed, fallback);
    }
    return fallback;
  } catch (error: any) {
    console.error('[ai-service]: Failed to parse conversational log:', error);
    return fallback;
  }
}
