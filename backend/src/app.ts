import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { z } from 'zod';
import { getDbStatus } from './config/mongodb.js';
import { config } from './config/index.js';
import { createCsrfToken, getAuthCookieOptions, getClearAuthCookieOptions, getCsrfCookieOptions, JWT_SECRET, SESSION_EXPIRES_IN } from './config/security.js';
import { 
  Users, 
  Roles, 
  Leads, 
  Opportunities, 
  Tasks, 
  Quotations, 
  Products, 
  Requests, 
  DiscountLimits, 
  Notifications,
  AILogs,
  AuditLogs,
  MemoryStore
} from './models/db.js';
import { getAICoachSuggestions, parseConversationalLog } from './services/ai.service.js';
import type { ConversationalTaskType, ParsedConversationalLog, UrgencyLevel } from './services/ai.service.js';
import { getQuoteStatusForDiscount, getUserDiscountLimit, isDiscountOverLimit } from './utils/discount.js';
import { hashPassword, validatePasswordPolicy, verifyPassword } from './utils/password.js';
import { doTimeRangesOverlap, evaluateAvailability } from './utils/schedule.js';
import productsRouter from './routes/products.js';
import pdfRouter from './routes/pdf.js';
import { errorHandler } from './middlewares/errorHandler.js';
import jwt from 'jsonwebtoken';
const app = express();

app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));
// ES module compatible __dirname
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a write stream (in append mode) for request logs
const logDirectory = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}
const accessLogStream = fs.createWriteStream(path.join(logDirectory, 'access.log'), { flags: 'a' });
// Use morgan to log to file (combined format) as well as dev console
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Helper to retrieve current user from token (mock cookie or JWT)
async function getCurrentUser(req: express.Request) {
  // Check Authorization header for JWT Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await Users().findOne({ _id: payload.userId } as any);
      return user || null;
    } catch {
      return null;
    }
  }
  // Fallback to mock token in cookies
  const cookieToken = req.cookies?.token;
  if (!cookieToken) return null;
  if (cookieToken.startsWith('mock_token_')) {
    const userId = cookieToken.replace('mock_token_', '');
    const userColl = Users();
    return await userColl.findOne({ _id: userId } as any);
  }
  try {
    const payload = jwt.verify(cookieToken, JWT_SECRET) as { userId: string };
    return await Users().findOne({ _id: payload.userId } as any);
  } catch {
    return null;
  }
}

async function findAll<T>(collection: any, query: any = {}): Promise<T[]> {
  const result = await collection.find(query);
  if (Array.isArray(result)) return result as T[];
  return await result.toArray();
}

function isRootAdmin(user: any): boolean {
  return user?.email === 'root@nextgen.co.th';
}

function sanitizeUser(user: any) {
  if (!user) return user;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function auditSafe(value: any): any {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(auditSafe);
  const { passwordHash, password, ...safeValue } = value;
  return safeValue;
}

async function createAuditLog(req: express.Request, actor: any, action: string, targetType: string, target: any = {}, details: Record<string, unknown> = {}) {
  if (!actor) return;
  await AuditLogs().insertOne({
    _id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    actorId: actor._id,
    actorEmail: actor.email,
    action,
    targetType,
    targetId: target?._id,
    targetEmail: target?.email,
    details: auditSafe(details),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    createdAt: new Date()
  } as any);
}

function assertPasswordPolicy(password: string, res: express.Response): boolean {
  const policy = validatePasswordPolicy(password);
  if (!policy.valid) {
    res.status(400).json({ message: policy.errors.join(', ') });
    return false;
  }
  return true;
}

const DEFAULT_PERMISSIONS = {
  viewDashboard: false,
  manageLeads: false,
  managePipeline: false,
  manageTasks: false,
  useAIChat: false,
  viewTeamOverview: false,
  manageProducts: false,
  manageDiscounts: false,
  manageUsersAndRoles: false,
  editAdminCalendar: false,
  manageQuotes: false,
  approveRequests: false
};

type PermissionKey = keyof typeof DEFAULT_PERMISSIONS;

function validateBody(schema: z.ZodTypeAny): express.RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
        errors: parsed.error.issues.map(issue => ({
          field: issue.path.join('.') || 'body',
          message: issue.message
        }))
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

const dateStringSchema = z.string().refine(value => !Number.isNaN(Date.parse(value)), {
  message: 'ต้องเป็นวันที่หรือเวลาในรูปแบบที่ถูกต้อง'
});
const idSchema = z.string().trim().min(1, 'ต้องระบุรหัสอ้างอิง');
const optionalTextSchema = z.string().trim().optional();
const nonEmptyTextSchema = z.string().trim().min(1, 'ต้องกรอกข้อมูล');
const percentSchema = z.coerce.number().min(0).max(100);
const moneySchema = z.coerce.number().min(0);
const rankSchema = z.coerce.number().int().min(1).max(5);
const departmentSchema = z.enum(['AdminSupport', 'Finance', 'Academic', 'Production']);
const permissionsSchema = z.object(
  Object.keys(DEFAULT_PERMISSIONS).reduce((shape, key) => {
    shape[key as PermissionKey] = z.coerce.boolean().optional();
    return shape;
  }, {} as Record<PermissionKey, z.ZodTypeAny>)
).partial();

const loginBodySchema = z.object({
  email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง'),
  password: z.string()
}).strict();

const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX = 20;
const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const loginRateLimits = new Map<string, { count: number; windowStart: number }>();
const loginFailures = new Map<string, { count: number; lockedUntil?: number }>();

function clientKey(req: express.Request) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function requireLoginRateLimit(): express.RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const key = clientKey(req);
    const existing = loginRateLimits.get(key);
    if (!existing || now - existing.windowStart > LOGIN_RATE_LIMIT_WINDOW_MS) {
      loginRateLimits.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > LOGIN_RATE_LIMIT_MAX) {
      res.status(429).json({ message: 'มีการพยายามเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' });
      return;
    }
    next();
  };
}

function accountLockoutStatus(email: string) {
  const record = loginFailures.get(email.toLowerCase());
  if (!record?.lockedUntil) return { locked: false, remainingMs: 0 };
  const remainingMs = record.lockedUntil - Date.now();
  if (remainingMs <= 0) {
    loginFailures.delete(email.toLowerCase());
    return { locked: false, remainingMs: 0 };
  }
  return { locked: true, remainingMs };
}

function recordFailedLogin(email: string) {
  const key = email.toLowerCase();
  const record = loginFailures.get(key) || { count: 0 };
  const count = record.count + 1;
  loginFailures.set(key, {
    count,
    lockedUntil: count >= LOGIN_LOCKOUT_THRESHOLD ? Date.now() + LOGIN_LOCKOUT_MS : undefined
  });
}

function clearFailedLogin(email: string) {
  loginFailures.delete(email.toLowerCase());
}

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'ต้องกรอกรหัสผ่านปัจจุบัน'),
  newPassword: z.string().min(1, 'ต้องกรอกรหัสผ่านใหม่')
}).strict();

const swapUserBodySchema = z.object({
  targetUserId: idSchema
}).strict();

const createUserBodySchema = z.object({
  name: nonEmptyTextSchema,
  email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง'),
  password: z.string().optional(),
  roleId: idSchema,
  rank: rankSchema,
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  zone: optionalTextSchema
}).strict();

const updateUserBodySchema = z.object({
  name: nonEmptyTextSchema.optional(),
  email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง').optional(),
  roleId: idSchema.optional(),
  rank: rankSchema.optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  zone: optionalTextSchema,
  forcePasswordChange: z.coerce.boolean().optional()
}).strict();

const passwordResetBodySchema = z.object({
  password: z.string().min(1, 'ต้องกรอกรหัสผ่านใหม่')
}).strict();

const roleBodySchema = z.object({
  name: nonEmptyTextSchema,
  rank: rankSchema,
  color: z.string().trim().min(1).optional(),
  permissions: permissionsSchema.optional()
}).strict();

const roleUpdateBodySchema = roleBodySchema.partial().strict();

const quoteItemSchema = z.object({
  productId: idSchema.optional(),
  name: nonEmptyTextSchema.optional(),
  description: optionalTextSchema,
  quantity: z.coerce.number().min(0).optional(),
  unitPrice: moneySchema.optional(),
  price: moneySchema.optional(),
  discountPercent: percentSchema.optional(),
  total: moneySchema.optional()
}).passthrough();

const createQuoteBodySchema = z.object({
  leadId: idSchema.optional(),
  items: z.array(quoteItemSchema).default([]),
  overallDiscountPercent: percentSchema.default(0),
  vatPercent: percentSchema.default(7),
  totalAmount: moneySchema.default(0),
  expiresAt: dateStringSchema.optional(),
  terms: optionalTextSchema
}).strict();

const reviseQuoteBodySchema = z.object({
  items: z.array(quoteItemSchema).optional(),
  overallDiscountPercent: percentSchema.optional(),
  vatPercent: percentSchema.optional(),
  totalAmount: moneySchema.optional(),
  expiresAt: dateStringSchema.optional(),
  terms: optionalTextSchema,
  reason: optionalTextSchema
}).strict();

const sendQuoteBodySchema = z.object({
  customerEmail: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง').optional()
}).strict();

const acceptQuoteBodySchema = z.object({
  customerName: nonEmptyTextSchema
}).strict();

const decisionBodySchema = z.object({
  status: z.enum(['Approved', 'Rejected']),
  reason: optionalTextSchema
}).strict();

const discountLimitSchema = z.object({
  roleId: idSchema.optional(),
  userId: idSchema.optional(),
  maxDiscountPercent: percentSchema
}).refine(value => Boolean(value.roleId || value.userId), {
  message: 'ต้องระบุ roleId หรือ userId'
});

const discountSettingsBodySchema = z.object({
  roleLimits: z.array(discountLimitSchema).default([]),
  individualLimits: z.array(discountLimitSchema).default([])
}).strict();

const createRequestBodySchema = z.object({
  title: nonEmptyTextSchema,
  leadId: idSchema.optional(),
  type: z.enum(['AdminSupport', 'Finance', 'Academic', 'Production', 'Other']).default('AdminSupport'),
  subTypes: z.array(z.string().trim().min(1)).default([]),
  targetDepartment: departmentSchema.default('AdminSupport'),
  targetUserId: idSchema.optional(),
  reason: optionalTextSchema,
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  isDraft: z.coerce.boolean().default(false),
  attachments: z.array(z.object({
    name: nonEmptyTextSchema,
    url: optionalTextSchema
  })).default([]),
  startAt: dateStringSchema,
  endAt: dateStringSchema
}).strict().refine(value => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), {
  path: ['endAt'],
  message: 'วันและเวลาสิ้นสุดต้องมากกว่าวันและเวลาเริ่มต้น'
});

const opportunityStageSchema = z.enum(['Qualified', 'Proposal', 'Demo', 'Negotiation', 'Won', 'Lost']);
const createOpportunityBodySchema = z.object({
  leadId: idSchema,
  title: nonEmptyTextSchema,
  stage: opportunityStageSchema.default('Qualified'),
  value: moneySchema.default(0),
  closeDate: dateStringSchema,
  assignedTo: idSchema.optional(),
  probability: percentSchema.optional(),
  quoteIds: z.array(idSchema).default([])
}).strict().refine(value => new Date(value.closeDate).getTime() >= new Date(new Date().toDateString()).getTime(), {
  path: ['closeDate'],
  message: 'วันที่คาดว่าจะปิดการขายต้องไม่เป็นวันในอดีต'
});

const updateOpportunityBodySchema = z.object({
  title: nonEmptyTextSchema.optional(),
  value: moneySchema.optional(),
  closeDate: dateStringSchema.optional(),
  assignedTo: idSchema.optional(),
  probability: percentSchema.optional(),
  quoteIds: z.array(idSchema).optional()
}).strict();

const opportunityStageBodySchema = z.object({
  stage: opportunityStageSchema,
  reason: optionalTextSchema,
  lostReason: optionalTextSchema,
  probability: percentSchema.optional()
}).strict().refine(value => value.stage !== 'Lost' || Boolean(value.lostReason || value.reason), {
  path: ['lostReason'],
  message: 'ต้องระบุเหตุผลเมื่อเปลี่ยนเป็น Lost'
});

const taskTypeSchema = z.enum(['Call', 'Meeting', 'Demo', 'FollowUp', 'Other']);
const taskStatusSchema = z.enum(['Pending', 'Completed', 'Overdue']);
const recurrenceRuleSchema = z.enum(['none', 'daily', 'weekly', 'monthly']);
const createTaskBodySchema = z.object({
  title: nonEmptyTextSchema,
  description: optionalTextSchema,
  type: taskTypeSchema.default('Meeting'),
  startAt: dateStringSchema,
  endAt: dateStringSchema,
  leadId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  requestId: idSchema.optional(),
  reminderMinutesBefore: z.coerce.number().int().min(0).max(10080).optional(),
  recurrenceRule: recurrenceRuleSchema.default('none'),
  recurrenceCount: z.coerce.number().int().min(1).max(24).default(1),
  participantIds: z.array(idSchema).default([])
}).strict().refine(value => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), {
  path: ['endAt'],
  message: 'วันและเวลาสิ้นสุดต้องมากกว่าวันและเวลาเริ่มต้น'
});

const updateTaskBodySchema = z.object({
  title: nonEmptyTextSchema.optional(),
  description: optionalTextSchema,
  type: taskTypeSchema.optional(),
  startAt: dateStringSchema.optional(),
  endAt: dateStringSchema.optional(),
  status: taskStatusSchema.optional(),
  leadId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  requestId: idSchema.optional(),
  reminderMinutesBefore: z.coerce.number().int().min(0).max(10080).optional(),
  participantIds: z.array(idSchema).optional()
}).strict().refine(value => {
  if (!value.startAt || !value.endAt) return true;
  return new Date(value.endAt).getTime() > new Date(value.startAt).getTime();
}, {
  path: ['endAt'],
  message: 'วันและเวลาสิ้นสุดต้องมากกว่าวันและเวลาเริ่มต้น'
});

const taskConflictBodySchema = z.object({
  startAt: dateStringSchema,
  endAt: dateStringSchema,
  participantIds: z.array(idSchema).default([])
}).strict().refine(value => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), {
  path: ['endAt'],
  message: 'วันและเวลาสิ้นสุดต้องมากกว่าวันและเวลาเริ่มต้น'
});

const taskRespondBodySchema = z.object({
  status: z.enum(['Accepted', 'Acknowledged', 'Declined']),
  reason: optionalTextSchema
}).strict();

const taskCommentBodySchema = z.object({
  content: nonEmptyTextSchema
}).strict();

const notificationPreferencesBodySchema = z.object({
  categories: z.object({
    Request: z.coerce.boolean().default(true),
    Quote: z.coerce.boolean().default(true),
    Task: z.coerce.boolean().default(true),
    Calendar: z.coerce.boolean().default(true),
    System: z.coerce.boolean().default(true)
  }).partial().default({}),
  digestOnly: z.coerce.boolean().default(false)
}).strict();

const aiConfirmReviewBodySchema = z.object({
  confirmLowConfidence: z.coerce.boolean().optional()
}).passthrough();

const declineRequestBodySchema = z.object({
  reason: nonEmptyTextSchema
}).strict();

const forwardRequestBodySchema = z.object({
  targetDepartment: departmentSchema,
  reason: optionalTextSchema
}).strict();

const requestCommentBodySchema = z.object({
  content: nonEmptyTextSchema
}).strict();

const completeRequestBodySchema = z.object({
  note: optionalTextSchema
}).strict();

const adminCalendarUpdateBodySchema = z.object({
  title: nonEmptyTextSchema.optional(),
  startAt: dateStringSchema.optional(),
  endAt: dateStringSchema.optional(),
  status: z.enum(['Pending', 'Completed', 'Overdue', 'Submitted', 'Approved', 'Rejected', 'Acknowledged', 'Claimed']).optional(),
  targetDepartment: departmentSchema.optional()
}).strict();

const adminCalendarCreateBodySchema = z.object({
  title: nonEmptyTextSchema,
  description: optionalTextSchema,
  department: departmentSchema.default('AdminSupport'),
  ownerId: idSchema.optional(),
  startAt: dateStringSchema,
  endAt: dateStringSchema
}).strict().refine(value => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), {
  path: ['endAt'],
  message: 'วันและเวลาสิ้นสุดต้องมากกว่าวันและเวลาเริ่มต้น'
});

const aiParseBodySchema = z.object({
  text: z.string().trim().min(1, 'กรุณากรอกข้อความสนทนา').max(3000, 'ข้อความยาวเกินไป กรุณาย่อให้ไม่เกิน 3,000 ตัวอักษร')
}).strict();

const aiConfirmBodySchema = z.object({
  title: nonEmptyTextSchema,
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ไม่ถูกต้อง'),
  timeStr: z.string().regex(/^\d{2}:\d{2}$/, 'รูปแบบเวลาไม่ถูกต้อง'),
  type: z.string().optional(),
  urgency: z.string().optional(),
  leadId: idSchema.optional(),
  aiLogId: idSchema.optional(),
  participantIds: z.array(idSchema).default([]),
  rawText: z.string().optional()
}).passthrough();

const phoneSchema = z.preprocess(
  value => value === '' ? undefined : value,
  z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, 'รูปแบบเบอร์โทรไม่ถูกต้อง').optional()
);
const optionalEmailSchema = z.preprocess(
  value => value === '' ? undefined : value,
  z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง').optional()
);
const leadContactSchema = z.object({
  name: nonEmptyTextSchema,
  position: optionalTextSchema,
  phone: phoneSchema,
  email: optionalEmailSchema
}).strict();

const leadNoteSchema = z.object({
  author: nonEmptyTextSchema,
  content: nonEmptyTextSchema,
  type: z.enum(['General', 'Call', 'Meeting', 'Coaching', 'FollowUp']).default('General'),
  createdAt: dateStringSchema.optional()
}).passthrough();

const leadAttachmentSchema = z.object({
  name: nonEmptyTextSchema,
  url: z.string().trim().min(1),
  type: optionalTextSchema,
  uploadedAt: dateStringSchema.optional(),
  uploadedBy: idSchema.optional()
}).strict();

const leadStatusSchema = z.enum(['Cold', 'Warm', 'Hot', 'Customer']);
const leadStageSchema = z.enum(['New Lead', 'Contacted', 'Interested', 'Demo Scheduled', 'Proposal Sent', 'Pilot/Trial', 'Closed Won', 'Closed Lost']);
const optionalNumberSchema = z.coerce.number().min(0).optional();
const optionalDateTextSchema = z.string().trim().optional().refine(value => !value || !Number.isNaN(Date.parse(value)), {
  message: 'ต้องเป็นวันที่หรือเวลาในรูปแบบที่ถูกต้อง'
});
const createLeadBodySchema = z.object({
  schoolName: nonEmptyTextSchema,
  address: optionalTextSchema,
  zone: optionalTextSchema,
  status: leadStatusSchema.default('Cold'),
  stage: leadStageSchema.default('New Lead'),
  score: z.coerce.number().min(0).max(100).default(10),
  gradeLevels: optionalTextSchema,
  educationAuthority: optionalTextSchema,
  district: optionalTextSchema,
  province: optionalTextSchema,
  studentCount: optionalNumberSchema,
  upperElementaryStudentCount: optionalNumberSchema,
  lastContactedAt: optionalDateTextSchema,
  nextCallAt: optionalDateTextSchema,
  documentStatus: optionalTextSchema,
  remarks: optionalTextSchema,
  legacySaleName: optionalTextSchema,
  source: optionalTextSchema,
  campaign: optionalTextSchema,
  assignedTo: idSchema.optional(),
  contacts: z.array(leadContactSchema).default([]),
  attachments: z.array(leadAttachmentSchema).default([])
}).strict();

const updateLeadBodySchema = z.object({
  status: leadStatusSchema.optional(),
  stage: leadStageSchema.optional(),
  score: z.coerce.number().min(0).max(100).optional(),
  schoolName: nonEmptyTextSchema.optional(),
  address: optionalTextSchema,
  zone: optionalTextSchema,
  gradeLevels: optionalTextSchema,
  educationAuthority: optionalTextSchema,
  district: optionalTextSchema,
  province: optionalTextSchema,
  studentCount: optionalNumberSchema,
  upperElementaryStudentCount: optionalNumberSchema,
  lastContactedAt: optionalDateTextSchema,
  nextCallAt: optionalDateTextSchema,
  documentStatus: optionalTextSchema,
  remarks: optionalTextSchema,
  legacySaleName: optionalTextSchema,
  source: optionalTextSchema,
  campaign: optionalTextSchema,
  assignedTo: idSchema.optional(),
  transferReason: optionalTextSchema,
  archived: z.coerce.boolean().optional(),
  contacts: z.array(leadContactSchema).optional(),
  notes: z.array(leadNoteSchema).optional(),
  attachments: z.array(leadAttachmentSchema).optional()
}).strict();

app.use(async (req, _res, next) => {
  if (!req.path.startsWith('/api') || req.path === '/api/status' || req.path === '/api/auth/login') {
    next();
    return;
  }

  try {
    const currentUser = await getCurrentUser(req);
    if (currentUser) {
      console.info(`[active-user] ${currentUser.email} (${currentUser.name}) ${req.method} ${req.originalUrl}`);
    }
  } catch (err) {
    console.warn('[active-user] Unable to resolve current user for request:', req.method, req.originalUrl);
  }

  next();
});

function getSupportDepartment(user: any): 'AdminSupport' | 'Finance' | 'Academic' | 'Production' {
  if (user?.email?.includes('finance')) return 'Finance';
  if (user?.email?.includes('academic')) return 'Academic';
  if (user?.email?.includes('prod')) return 'Production';
  return 'AdminSupport';
}

function asDate(value: any): Date {
  return value instanceof Date ? value : new Date(value);
}

function addDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function buildStatusHistoryEntry(currentUser: any, toStatus: string, fromStatus?: string, reason?: string) {
  return {
    fromStatus,
    toStatus,
    actorId: currentUser._id,
    actorName: currentUser.name,
    reason,
    changedAt: new Date()
  };
}

async function nextDocumentNumber(collection: any, prefix: string) {
  const year = new Date().getFullYear();
  const docs = await findAll<any>(collection);
  const max = docs.reduce((highest, item) => {
    const match = String(item.quoteNumber || item.requestNumber || '').match(new RegExp(`^${prefix}-${year}-(\\d{4,})$`));
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

async function userCanAccessQuote(user: any, quote: any): Promise<boolean> {
  if (!user || !quote) return false;
  if (user.rank >= 4 || isRootAdmin(user)) return true;
  if (user.rank === 3) return quote.creatorId === user._id;
  return getSupportDepartment(user) === 'Finance';
}

async function getRequiredQuoteApprovalRank(discountPercent: number, limits: any) {
  const roles = await findAll<any>(Roles());
  const managerRoles = roles.filter(role => role.rank === 4).map(role => role._id);
  const managerLimits = (limits?.roleLimits || [])
    .filter((limit: any) => managerRoles.includes(limit.roleId))
    .map((limit: any) => Number(limit.maxDiscountPercent || 0));
  const managerMax = managerLimits.length ? Math.max(...managerLimits) : 20;
  return Number(discountPercent || 0) > managerMax ? 5 as const : 4 as const;
}

async function userCanAccessRequest(user: any, request: any): Promise<boolean> {
  if (!user || !request) return false;
  if (user.rank >= 4 || isRootAdmin(user)) return true;
  if (request.creatorId === user._id || request.targetUserId === user._id || request.assignment?.assignedToId === user._id) return true;
  return user.rank === 2 && request.targetDepartment === getSupportDepartment(user) && request.approvalFlow?.status !== 'Pending';
}

async function notifySupportDepartment(targetDepartment: string, title: string, message: string) {
  const users = await findAll<any>(Users());
  await Promise.all(users
    .filter(user => user.rank === 2 && getSupportDepartment(user) === targetDepartment)
    .map(user => createNotification(user._id, title, message, 'RequestStatus', '/requests')));
}

async function hasScheduleConflict(startAt: Date, endAt: Date, exclude?: { source: string; id: string }) {
  const [tasks, requests] = await Promise.all([
    findAll<any>(Tasks()),
    findAll<any>(Requests())
  ]);
  const taskConflict = tasks.some(task =>
    !(exclude?.source === 'task' && exclude.id === task._id) &&
    doTimeRangesOverlap({ startAt: task.startAt, endAt: task.endAt }, { startAt, endAt })
  );
  const requestConflict = requests.some(request =>
    !(exclude?.source === 'request' && exclude.id === request._id) &&
    !['Rejected', 'Completed'].includes(request.status) &&
    doTimeRangesOverlap({ startAt: request.startAt, endAt: request.endAt }, { startAt, endAt })
  );
  return taskConflict || requestConflict;
}

async function canUseAIChat(user: any): Promise<boolean> {
  if (!user) return false;
  const role = await Roles().findOne({ _id: user.roleId } as any);
  return Boolean(role?.permissions?.useAIChat);
}

async function userHasPermission(user: any, permission: PermissionKey): Promise<boolean> {
  if (!user) return false;
  if (isRootAdmin(user)) return true;
  if (['manageQuotes', 'manageDiscounts'].includes(permission) && getSupportDepartment(user) === 'Finance') return true;
  const role = await Roles().findOne({ _id: user.roleId } as any);
  return Boolean(role?.permissions?.[permission]);
}

function requireAuthenticated(): express.RequestHandler {
  return async (req, res, next) => {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    (req as any).currentUser = currentUser;
    next();
  };
}

function requirePermission(permission: PermissionKey): express.RequestHandler {
  return async (req, res, next) => {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    if (!(await userHasPermission(currentUser, permission))) {
      res.status(403).json({ message: `ไม่มีสิทธิ์ใช้งานส่วนนี้ (${permission})` });
      return;
    }
    (req as any).currentUser = currentUser;
    next();
  };
}

function requireRank(minRank: number): express.RequestHandler {
  return async (req, res, next) => {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    if (currentUser.rank < minRank) {
      res.status(403).json({ message: 'Insufficient rank' });
      return;
    }
    (req as any).currentUser = currentUser;
    next();
  };
}

function normalizePermissions(input: any) {
  if (Array.isArray(input)) {
    return input.reduce((acc, key) => ({ ...acc, [key]: true }), { ...DEFAULT_PERMISSIONS });
  }
  if (input && typeof input === 'object') {
    return Object.keys(DEFAULT_PERMISSIONS).reduce((acc, key) => ({
      ...acc,
      [key]: Boolean(input[key])
    }), { ...DEFAULT_PERMISSIONS });
  }
  return { ...DEFAULT_PERMISSIONS };
}

async function createNotification(
  userId: string | undefined,
  title: string,
  message: string,
  type: 'RequestApproval' | 'RequestStatus' | 'CalendarInvite' | 'TaskStatus' | 'QuoteApproval' | 'QuoteStatus',
  targetUrl: string
) {
  if (!userId) return;
  const category = type.startsWith('Request') ? 'Request'
    : type.startsWith('Quote') ? 'Quote'
      : type.startsWith('Task') ? 'Task'
        : type === 'CalendarInvite' ? 'Calendar'
          : 'System';
  const user = await Users().findOne({ _id: userId } as any);
  const preferences = user?.notificationPreferences;
  if (preferences?.digestOnly || preferences?.categories?.[category] === false) return;

  const existing = await findAll<any>(Notifications(), { userId });
  const recentDuplicate = existing.find(item =>
    !item.archivedAt &&
    item.type === type &&
    item.title === title &&
    item.targetUrl === targetUrl &&
    Date.now() - asDate(item.createdAt).getTime() < 5 * 60 * 1000
  );
  if (recentDuplicate) return;

  await Notifications().insertOne({
    _id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    title,
    message,
    type,
    targetUrl,
    category,
    isRead: false,
    createdAt: new Date()
  } as any);
}

async function notifyManagers(title: string, message: string, type: 'RequestApproval' | 'QuoteApproval', targetUrl: string, excludeUserId?: string) {
  const users = await findAll<any>(Users());
  await Promise.all(
    users
      .filter(user => user.rank >= 4 && user._id !== excludeUserId)
      .map(user => createNotification(user._id, title, message, type, targetUrl))
  );
}

const AI_TASK_TYPES: ConversationalTaskType[] = ['Call', 'Meeting', 'Demo', 'FollowUp', 'Other'];
const AI_URGENCY_LEVELS: UrgencyLevel[] = ['Low', 'Medium', 'High'];

function normalizeForLeadMatch(value?: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/^โรงเรียน/, '')
    .replace(/\s+/g, '')
    .trim();
}

async function findVisibleLeadMatch(currentUser: any, parsed: Partial<ParsedConversationalLog>, rawText = '') {
  const leads = await findAll<any>(Leads());
  const visibleLeads = currentUser?.rank === 3
    ? leads.filter(lead => lead.assignedTo === currentUser._id || lead.zone === currentUser.zone)
    : leads;

  const mention = normalizeForLeadMatch(parsed.schoolMentioned);
  const input = normalizeForLeadMatch(rawText);

  return visibleLeads.find(lead => {
    const schoolName = normalizeForLeadMatch(lead.schoolName);
    const contactMatched = Array.isArray(lead.contacts) && lead.contacts.some((contact: any) => {
      const contactName = normalizeForLeadMatch(contact.name);
      return Boolean(contactName && input.includes(contactName));
    });

    if (mention && (schoolName.includes(mention) || mention.includes(schoolName))) return true;
    if (schoolName && input.includes(schoolName)) return true;
    return contactMatched;
  }) || null;
}

function enrichParsedLogWithLead(parsed: ParsedConversationalLog, lead: any) {
  if (!lead) return parsed;
  const primaryContact = Array.isArray(lead.contacts) ? lead.contacts[0] : null;
  return {
    ...parsed,
    schoolMentioned: parsed.schoolMentioned || lead.schoolName,
    contactName: parsed.contactName || primaryContact?.name,
    contactPhone: parsed.contactPhone || primaryContact?.phone,
    contactEmail: parsed.contactEmail || primaryContact?.email
  };
}

function buildAILogDescription(body: any, lead: any): string {
  const lines = [
    body.notes ? `สรุปจาก AI: ${body.notes}` : '',
    body.rawText ? `ข้อความต้นฉบับ: ${body.rawText}` : '',
    body.schoolMentioned ? `โรงเรียนที่กล่าวถึง: ${body.schoolMentioned}` : '',
    lead ? `Lead ที่เชื่อมโยง: ${lead.schoolName}` : '',
    body.contactName ? `ผู้ติดต่อ: ${body.contactName}` : '',
    body.contactPhone ? `โทร: ${body.contactPhone}` : '',
    body.contactEmail ? `อีเมล: ${body.contactEmail}` : '',
    body.urgency ? `ระดับความเร่งด่วน: ${body.urgency}` : ''
  ];
  return lines.filter(Boolean).join('\n');
}

function normalizeDuplicateKey(value?: string) {
  return (value || '').toLowerCase().replace(/^โรงเรียน/, '').replace(/\s+/g, '').trim();
}

function normalizePhone(value?: string) {
  return (value || '').replace(/\D/g, '');
}

function userCanSeeLead(user: any, lead: any) {
  if (!user || !lead) return false;
  if (user.rank >= 4 || isRootAdmin(user)) return true;
  return lead.assignedTo === user._id || lead.zone === user.zone;
}

function findLeadDuplicates(leads: any[], candidate: any, excludeId?: string) {
  const nameKey = normalizeDuplicateKey(candidate.schoolName);
  const phones = new Set((candidate.contacts || []).map((contact: any) => normalizePhone(contact.phone)).filter(Boolean));
  const emails = new Set((candidate.contacts || []).map((contact: any) => String(contact.email || '').toLowerCase()).filter(Boolean));

  return leads
    .filter(lead => lead._id !== excludeId && !lead.archived)
    .filter(lead => {
      if (nameKey && normalizeDuplicateKey(lead.schoolName) === nameKey) return true;
      const leadContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
      return leadContacts.some((contact: any) => {
        const phone = normalizePhone(contact.phone);
        const email = String(contact.email || '').toLowerCase();
        return (phone && phones.has(phone)) || (email && emails.has(email));
      });
    })
    .map(lead => ({ _id: lead._id, schoolName: lead.schoolName, zone: lead.zone, status: lead.status }));
}

function hydrateLeadForResponse(lead: any) {
  return {
    ...lead,
    stage: lead.stage || 'New Lead'
  };
}

function buildAILogParsedPayload(body: any, type: ConversationalTaskType, urgency: UrgencyLevel) {
  return {
    title: typeof body?.title === 'string' ? body.title.trim() : '',
    type,
    dateStr: typeof body?.dateStr === 'string' ? body.dateStr : '',
    timeStr: typeof body?.timeStr === 'string' ? body.timeStr : '',
    schoolMentioned: typeof body?.schoolMentioned === 'string' ? body.schoolMentioned.trim() : undefined,
    contactName: typeof body?.contactName === 'string' ? body.contactName.trim() : undefined,
    contactPhone: typeof body?.contactPhone === 'string' ? body.contactPhone.trim() : undefined,
    contactEmail: typeof body?.contactEmail === 'string' ? body.contactEmail.trim() : undefined,
    urgency,
    notes: typeof body?.notes === 'string' ? body.notes.trim() : '',
    confidence: typeof body?.confidence === 'number' ? body.confidence : undefined,
    missingFields: Array.isArray(body?.missingFields) ? body.missingFields : undefined
  };
}

async function appendAINoteToLead(lead: any, currentUser: any, body: any, taskId: string) {
  if (!lead) return;

  const leadsColl = Leads();
  const noteContent = [
    `[AI Logger] ${body.title || 'บันทึกกิจกรรมจาก AI'}`,
    body.notes ? `สรุป: ${body.notes}` : '',
    body.contactName ? `ผู้ติดต่อ: ${body.contactName}` : '',
    body.urgency ? `ความเร่งด่วน: ${body.urgency}` : '',
    `Task ID: ${taskId}`
  ].filter(Boolean).join('\n');

  const updatedLead = {
    ...lead,
    notes: [
      ...(Array.isArray(lead.notes) ? lead.notes : []),
      {
        author: currentUser.name,
        content: noteContent,
        createdAt: new Date()
      }
    ],
    updatedAt: new Date()
  };

  await (leadsColl as any).updateOne({ _id: lead._id }, { $set: updatedLead });
}

// ------------------------------------------------------------------------------
// SYSTEM STATUS
// ------------------------------------------------------------------------------
app.get('/api/status', (req, res) => {
  const database = getDbStatus();
  res.json({
    status: database.memoryWriteBlocked ? 'degraded' : 'online',
    database,
    timestamp: new Date()
  });
});

app.use('/api', (req, res, next) => {
  const isWriteRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const database = getDbStatus();
  if (isWriteRequest && database.memoryWriteBlocked) {
    res.status(503).json({
      message: 'Database writes are disabled because MongoDB is unavailable and memory DB fallback is not allowed.',
      database
    });
    return;
  }
  next();
});

app.use('/api', (req, res, next) => {
  const isWriteRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const isLoginRequest = req.path === '/auth/login';
  const hasBearerToken = req.headers.authorization?.startsWith('Bearer ');
  const usesCookieAuth = Boolean(req.cookies?.token) && !hasBearerToken;
  if (!isWriteRequest || isLoginRequest || !usesCookieAuth) {
    next();
    return;
  }

  const csrfHeader = req.headers['x-csrf-token'];
  const csrfToken = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
  if (!csrfToken || csrfToken !== req.cookies?.csrfToken) {
    res.status(403).json({ message: 'CSRF token is missing or invalid' });
    return;
  }
  next();
});

// ------------------------------------------------------------------------------
// AUTHENTICATION
// ------------------------------------------------------------------------------
  // Existing mock login (keep for dev convenience)
  app.post('/api/auth/login', requireLoginRateLimit(), validateBody(loginBodySchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const lockout = accountLockoutStatus(email);
    if (lockout.locked) {
      res.status(423).json({ message: 'บัญชีถูกล็อกชั่วคราวจากการเข้าสู่ระบบผิดหลายครั้ง กรุณาลองใหม่ภายหลัง' });
      return;
    }

    const user = await Users().findOne({ email } as any);
    const passwordCheck = user ? verifyPassword(String(password || ''), user.passwordHash) : { valid: false, needsRehash: false };
    if (!user || !passwordCheck.valid) {
      recordFailedLogin(email);
      res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }
    clearFailedLogin(email);
    if (user.status && user.status !== 'active') {
      res.status(403).json({ message: 'บัญชีนี้ถูกปิดใช้งานหรือระงับ กรุณาติดต่อผู้ดูแลระบบ' });
      return;
    }
    if (passwordCheck.needsRehash) {
      const updatedAt = new Date();
      await (Users() as any).updateOne({ _id: user._id }, {
        $set: {
          passwordHash: hashPassword(String(password)),
          passwordChangedAt: user.passwordChangedAt || updatedAt,
          forcePasswordChange: user.forcePasswordChange ?? String(password) === '1234',
          updatedAt
        }
      });
      user.forcePasswordChange = user.forcePasswordChange ?? String(password) === '1234';
    }
    const loginAt = new Date();
    await (Users() as any).updateOne({ _id: user._id }, {
      $set: {
        lastLoginAt: loginAt,
        updatedAt: loginAt
      }
    });
    user.lastLoginAt = loginAt;
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: SESSION_EXPIRES_IN });
    const csrfToken = createCsrfToken();
    res.cookie('token', token, getAuthCookieOptions());
    res.cookie('csrfToken', csrfToken, getCsrfCookieOptions());
    console.info(`[auth-login] ${user.email} (${user.name}) logged in`);
    await createAuditLog(req, user, 'auth.login', 'user', user);
    res.json({ token, user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      rank: user.rank,
      zone: user.zone,
      roleId: user.roleId,
      forcePasswordChange: Boolean(user.forcePasswordChange)
    } });
  } catch (err) {
    console.error('[login] Unexpected error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

app.post('/api/auth/logout', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (currentUser) {
    await createAuditLog(req, currentUser, 'auth.logout', 'user', currentUser);
  }
  res.clearCookie('token', getClearAuthCookieOptions());
  res.clearCookie('csrfToken', getClearAuthCookieOptions());
  res.json({ message: 'Logged out' });
});

  // New JWT login endpoint (alias for existing login, kept for clarity)
  // You may use this endpoint instead of the mock login above.
  // It follows the same logic, so the implementation is already covered.
  // No additional code needed here.

  app.post('/api/auth/change-password', requireAuthenticated(), validateBody(changePasswordBodySchema), async (req, res) => {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    const passwordCheck = verifyPassword(String(currentPassword || ''), currentUser.passwordHash);
    if (!passwordCheck.valid) {
      res.status(400).json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
      return;
    }
    if (!assertPasswordPolicy(String(newPassword || ''), res)) return;

    const updatedAt = new Date();
    await (Users() as any).updateOne({ _id: currentUser._id }, {
      $set: {
        passwordHash: hashPassword(String(newPassword)),
        passwordChangedAt: updatedAt,
        forcePasswordChange: false,
        updatedBy: currentUser._id,
        updatedAt
      }
    });
    await createAuditLog(req, currentUser, 'password.change.self', 'user', currentUser, { forced: Boolean(currentUser.forcePasswordChange) });
    res.json({ message: 'Password changed', passwordChangedAt: updatedAt });
  });

  // User swap endpoint
  app.post('/api/auth/swap', validateBody(swapUserBodySchema), async (req, res) => {
    // Verify current JWT via getCurrentUser helper
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { targetUserId } = req.body;
    if (!targetUserId) {
      res.status(400).json({ message: 'targetUserId required' });
      return;
    }
    const targetUser = await Users().findOne({ _id: targetUserId } as any);
    if (!targetUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_QUICK_SWAP !== 'true') {
      res.status(403).json({ message: 'Quick Account Swapper is disabled in production' });
      return;
    }
    // Permission check: current rank must be >= target rank
    if (currentUser.rank < targetUser.rank) {
      res.status(403).json({ message: 'Insufficient rank to swap to this user' });
      return;
    }
    // Issue new JWT for target user
    const newToken = jwt.sign({ userId: targetUser._id }, JWT_SECRET, { expiresIn: SESSION_EXPIRES_IN });
    // Set cookie
    const csrfToken = createCsrfToken();
    res.cookie('token', newToken, getAuthCookieOptions());
    res.cookie('csrfToken', csrfToken, getCsrfCookieOptions());
    await createAuditLog(req, currentUser, 'auth.swap_user', 'user', targetUser, {
      fromUserId: currentUser._id,
      fromEmail: currentUser.email,
      toUserId: targetUser._id,
      toEmail: targetUser.email
    });
    // Return token & user data
    res.json({ token: newToken, user: {
      _id: targetUser._id,
      name: targetUser.name,
      email: targetUser.email,
      rank: targetUser.rank,
      zone: targetUser.zone,
      roleId: targetUser.roleId
    }});
  });

// ------------------------------------------------------------------------------
// USERS & ROLES
// ------------------------------------------------------------------------------
app.get('/api/users', requireAuthenticated(), async (req, res) => {
  const users = await findAll<any>(Users());
  res.json(users.map(sanitizeUser));
});

app.get('/api/audit-logs', requirePermission('manageUsersAndRoles'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 4) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ดู audit log' });
    return;
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const logs = await findAll<any>(AuditLogs());
  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(logs.slice(0, limit));
});

app.post('/api/users', requirePermission('manageUsersAndRoles'), validateBody(createUserBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 4) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงข้อมูล' });
    return;
  }

  const { name, email, password, roleId, rank, status, zone } = req.body;
  if (password && !isRootAdmin(currentUser)) {
    res.status(403).json({ message: 'เฉพาะ root@nextgen.co.th เท่านั้นที่สามารถกำหนดรหัสผ่านผู้ใช้ได้' });
    return;
  }
  if (password && !assertPasswordPolicy(String(password), res)) return;
  const initialPassword = password ? String(password) : '1234';

  // Strict Permission rule: Only Exec (rank 5) can assign Executive Assistant (r_asst)
  if (roleId === 'r_asst' && currentUser.rank < 5) {
    res.status(403).json({ message: 'เฉพาะผู้บริหารระดับสูงเท่านั้นที่สามารถมอบหมายสิทธิ์ผู้ช่วยผู้บริหารได้' });
    return;
  }

  const newUser = {
    _id: `u_${Date.now()}`,
    name,
    email,
    passwordHash: hashPassword(initialPassword),
    roleId,
    rank: Number(rank),
    status: status || 'active',
    zone,
    passwordChangedAt: password ? new Date() : undefined,
    forcePasswordChange: !password,
    createdBy: currentUser._id,
    updatedBy: currentUser._id,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await Users().insertOne(newUser);
  await createAuditLog(req, currentUser, 'user.create', 'user', newUser, { forcePasswordChange: newUser.forcePasswordChange });
  res.status(201).json(sanitizeUser(newUser));
});

// Update user
app.put('/api/users/:id', requirePermission('manageUsersAndRoles'), validateBody(updateUserBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 5) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้' });
    return;
  }
  const { id } = req.params;
  const { password, passwordHash, permissions, ...allowedUpdate } = req.body;
  if (password || passwordHash) {
    res.status(403).json({ message: 'กรุณาใช้เมนูจัดการรหัสผ่าน และต้องเป็น root@nextgen.co.th เท่านั้น' });
    return;
  }
  const updateData = allowedUpdate;
  // Prevent rank escalation unless root
  if (updateData.rank && currentUser.rank < 5) {
    res.status(403).json({ message: 'ไม่สามารถแก้ไขระดับผู้ใช้ได้' });
    return;
  }
  const userColl = Users();
  const existingUser = await userColl.findOne({ _id: id } as any);
  if (!existingUser) {
    res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    return;
  }
  const updatedUser = { ...existingUser, ...updateData, updatedBy: currentUser._id, updatedAt: new Date() };
  if ('updateOne' in userColl) {
    await (userColl as any).updateOne({ _id: id }, { $set: updatedUser });
  } else {
    const idx = (MemoryStore as any).users.findIndex((u: any) => u._id === id);
    if (idx !== -1) (MemoryStore as any).users[idx] = updatedUser;
  }
  await createAuditLog(req, currentUser, 'user.update', 'user', updatedUser, {
    before: sanitizeUser(existingUser),
    after: sanitizeUser(updatedUser),
    changedFields: Object.keys(updateData)
  });
  res.json(sanitizeUser(updatedUser));
});

app.put('/api/users/:id/password', requirePermission('manageUsersAndRoles'), validateBody(passwordResetBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !isRootAdmin(currentUser)) {
    res.status(403).json({ message: 'เฉพาะ root@nextgen.co.th เท่านั้นที่สามารถแก้ไขรหัสผ่านได้' });
    return;
  }

  const { id } = req.params;
  const { password } = req.body;
  if (!assertPasswordPolicy(String(password || ''), res)) return;

  const userColl = Users();
  const existingUser = await userColl.findOne({ _id: id } as any);
  if (!existingUser) {
    res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    return;
  }

  const updatedAt = new Date();
  await (userColl as any).updateOne({ _id: id }, {
    $set: {
      passwordHash: hashPassword(String(password)),
      passwordChangedAt: updatedAt,
      forcePasswordChange: false,
      updatedBy: currentUser._id,
      updatedAt
    }
  });
  await createAuditLog(req, currentUser, 'password.reset.by_root', 'user', existingUser);
  res.json({ ...sanitizeUser(existingUser), updatedAt, passwordUpdated: true });
});

// Delete user
app.delete('/api/users/:id', requirePermission('manageUsersAndRoles'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 5) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ลบผู้ใช้' });
    return;
  }
  const { id } = req.params;
  const userColl = Users();
  const existingUser = await userColl.findOne({ _id: id } as any);
  if (!existingUser) {
    res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    return;
  }
  if (existingUser._id === currentUser._id) {
    res.status(400).json({ message: 'ไม่สามารถลบบัญชีของตัวเองได้' });
    return;
  }
  if ('deleteOne' in userColl) {
    await (userColl as any).deleteOne({ _id: id });
  } else {
    const idx = (MemoryStore as any).users.findIndex((u: any) => u._id === id);
    if (idx !== -1) (MemoryStore as any).users.splice(idx, 1);
  }
  await createAuditLog(req, currentUser, 'user.delete', 'user', existingUser, {
    deletedUser: sanitizeUser(existingUser)
  });
  res.json({ message: 'User deleted' });
});


// Update role
app.put('/api/roles/:id', requirePermission('manageUsersAndRoles'), validateBody(roleUpdateBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 5) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขบทบาท' });
    return;
  }
  const { id } = req.params;
  const updateData = req.body;
  const roleColl = Roles();
  const existingRole = await roleColl.findOne({ _id: id } as any);
  if (!existingRole) {
    res.status(404).json({ message: 'ไม่พบบทบาท' });
    return;
  }
  const updatedRole = { ...existingRole, ...updateData, updatedAt: new Date() };
  if ('updateOne' in roleColl) {
    await (roleColl as any).updateOne({ _id: id }, { $set: updatedRole });
  } else {
    const idx = (MemoryStore as any).roles.findIndex((r: any) => r._id === id);
    if (idx !== -1) (MemoryStore as any).roles[idx] = updatedRole;
  }
  await createAuditLog(req, currentUser, 'role.update', 'role', updatedRole, {
    before: existingRole,
    after: updatedRole,
    changedFields: Object.keys(updateData)
  });
  res.json(updatedRole);
});

// Delete role
app.delete('/api/roles/:id', requirePermission('manageUsersAndRoles'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 5) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ลบบทบาท' });
    return;
  }
  const { id } = req.params;
  const roleColl = Roles();
  const existingRole = await roleColl.findOne({ _id: id } as any);
  if (!existingRole) {
    res.status(404).json({ message: 'ไม่พบบทบาท' });
    return;
  }
  if (existingRole.isSystemRole) {
    res.status(400).json({ message: 'ไม่สามารถลบบทบาทระบบได้' });
    return;
  }
  const usersInRole = await findAll<any>(Users(), { roleId: id });
  if (usersInRole.length > 0) {
    res.status(400).json({ message: 'ไม่สามารถลบบทบาทที่ยังมีผู้ใช้งานอยู่ได้' });
    return;
  }
  if ('deleteOne' in roleColl) {
    await (roleColl as any).deleteOne({ _id: id });
  } else {
    const idx = (MemoryStore as any).roles.findIndex((r: any) => r._id === id);
    if (idx !== -1) (MemoryStore as any).roles.splice(idx, 1);
  }
  await createAuditLog(req, currentUser, 'role.delete', 'role', existingRole, {
    deletedRole: existingRole
  });
  res.json({ message: 'Role deleted' });
});

app.get('/api/roles', requireAuthenticated(), async (req, res) => {
  const roles = await findAll<any>(Roles());
  res.json(roles);
});
app.post('/api/roles', requirePermission('manageUsersAndRoles'), validateBody(roleBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 5) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงข้อมูล' });
    return;
  }

  const { name, rank, color, permissions } = req.body;
  const newRole = {
    _id: `r_${Date.now()}`,
    name,
    rank: Number(rank),
    color,
    permissions: normalizePermissions(permissions),
    isSystemRole: false
  };

  await Roles().insertOne(newRole);
  await createAuditLog(req, currentUser, 'role.create', 'role', newRole, {
    createdRole: newRole
  });
  res.status(201).json(newRole);
});

// ------------------------------------------------------------------------------
// NOTIFICATIONS
// ------------------------------------------------------------------------------
app.get('/api/notifications', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
  const page = Math.max(Number(req.query.page || 1), 1);
  const category = typeof req.query.category === 'string' ? req.query.category : 'All';
  const unread = req.query.unread === 'true';
  const notifications = (await findAll<any>(Notifications(), { userId: currentUser._id }))
    .filter(item => !item.archivedAt)
    .filter(item => category === 'All' || item.category === category || String(item.type).startsWith(category))
    .filter(item => !unread || !item.isRead);
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const start = (page - 1) * limit;
  res.json({
    data: notifications.slice(start, start + limit),
    total: notifications.length,
    page,
    limit,
    unreadCount: notifications.filter(item => !item.isRead).length
  });
});

app.get('/api/notifications/stream', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendSnapshot = async () => {
    const notifications = (await findAll<any>(Notifications(), { userId: currentUser._id }))
      .filter(item => !item.archivedAt)
      .sort((a, b) => asDate(b.createdAt).getTime() - asDate(a.createdAt).getTime())
      .slice(0, 30);
    res.write(`event: notifications\n`);
    res.write(`data: ${JSON.stringify({
      data: notifications,
      unreadCount: notifications.filter(item => !item.isRead).length,
      generatedAt: new Date()
    })}\n\n`);
  };

  await sendSnapshot();
  const timer = setInterval(sendSnapshot, 30000);
  req.on('close', () => clearInterval(timer));
});

app.get('/api/notifications/preferences', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  res.json(currentUser.notificationPreferences || {
    categories: { Request: true, Quote: true, Task: true, Calendar: true, System: true },
    digestOnly: false
  });
});

app.put('/api/notifications/preferences', requireAuthenticated(), validateBody(notificationPreferencesBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const preferences = {
    categories: {
      Request: req.body.categories?.Request ?? true,
      Quote: req.body.categories?.Quote ?? true,
      Task: req.body.categories?.Task ?? true,
      Calendar: req.body.categories?.Calendar ?? true,
      System: req.body.categories?.System ?? true
    },
    digestOnly: Boolean(req.body.digestOnly)
  };
  await (Users() as any).updateOne({ _id: currentUser._id }, { $set: { notificationPreferences: preferences, updatedAt: new Date() } });
  res.json(preferences);
});

app.put('/api/notifications/read-all', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const notifications = (await findAll<any>(Notifications(), { userId: currentUser._id })).filter(item => !item.archivedAt);
  await Promise.all(notifications.map(notification =>
    (Notifications() as any).updateOne({ _id: notification._id }, { $set: { isRead: true } })
  ));
  res.json({ updated: notifications.length });
});

app.put('/api/notifications/cleanup', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const notifications = (await findAll<any>(Notifications(), { userId: currentUser._id }))
    .filter(item => !item.archivedAt && asDate(item.createdAt).getTime() < cutoff);
  await Promise.all(notifications.map(notification =>
    (Notifications() as any).updateOne({ _id: notification._id }, { $set: { archivedAt: new Date(), isRead: true } })
  ));
  res.json({ archived: notifications.length });
});

app.put('/api/notifications/:id/read', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const notification = await Notifications().findOne({ _id: req.params.id } as any);
  if (!notification || notification.userId !== currentUser._id) {
    res.status(404).json({ message: 'ไม่พบการแจ้งเตือน' });
    return;
  }

  await (Notifications() as any).updateOne({ _id: req.params.id }, { $set: { isRead: true } });
  res.json({ ...notification, isRead: true });
});

app.put('/api/notifications/:id/unread', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const notification = await Notifications().findOne({ _id: req.params.id } as any);
  if (!notification || notification.userId !== currentUser._id) {
    res.status(404).json({ message: 'ไม่พบการแจ้งเตือน' });
    return;
  }

  await (Notifications() as any).updateOne({ _id: req.params.id }, { $set: { isRead: false } });
  res.json({ ...notification, isRead: false });
});

// ------------------------------------------------------------------------------
// REPORTS
// ------------------------------------------------------------------------------
app.get('/api/reports/summary', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const dateFrom = typeof req.query.dateFrom === 'string' ? new Date(`${req.query.dateFrom}T00:00:00`) : null;
  const dateTo = typeof req.query.dateTo === 'string' ? new Date(`${req.query.dateTo}T23:59:59`) : null;
  const inRange = (value: any) => {
    const time = asDate(value || new Date()).getTime();
    if (dateFrom && time < dateFrom.getTime()) return false;
    if (dateTo && time > dateTo.getTime()) return false;
    return true;
  };

  const [leadsRaw, oppsRaw, quotesRaw, requestsRaw, tasksRaw, users] = await Promise.all([
    findAll<any>(Leads()),
    findAll<any>(Opportunities()),
    findAll<any>(Quotations()),
    findAll<any>(Requests()),
    findAll<any>(Tasks()),
    findAll<any>(Users())
  ]);
  const userMap = new Map(users.map((user: any) => [user._id, user]));
  const leads = leadsRaw.filter((lead: any) => userCanSeeLead(currentUser, lead)).filter((lead: any) => inRange(lead.createdAt || lead.updatedAt));
  const visibleLeadIds = new Set(leads.map((lead: any) => lead._id));
  const opportunities = oppsRaw.filter((opp: any) => currentUser.rank >= 4 || opp.assignedTo === currentUser._id || visibleLeadIds.has(opp.leadId)).filter((opp: any) => inRange(opp.createdAt || opp.updatedAt || opp.closeDate));
  const quotes = quotesRaw.filter((quote: any) => currentUser.rank >= 4 || quote.creatorId === currentUser._id || getSupportDepartment(currentUser) === 'Finance').filter((quote: any) => inRange(quote.createdAt || quote.updatedAt));
  const requests = requestsRaw.filter((request: any) => currentUser.rank >= 4 || request.creatorId === currentUser._id || request.assignment?.assignedToId === currentUser._id || (currentUser.rank === 2 && request.targetDepartment === getSupportDepartment(currentUser))).filter((request: any) => inRange(request.createdAt || request.updatedAt || request.startAt));
  const tasks = tasksRaw.filter((task: any) => currentUser.rank >= 4 || task.creatorId === currentUser._id || (task.participants || []).some((participant: any) => participant.userId === currentUser._id)).filter((task: any) => inRange(task.createdAt || task.updatedAt || task.startAt));

  const wonOpps = opportunities.filter((opp: any) => opp.stage === 'Won');
  const approvedQuotes = quotes.filter((quote: any) => quote.status === 'Approved');
  const pendingQuotes = quotes.filter((quote: any) => quote.status === 'PendingApproval');
  const rejectedQuotes = quotes.filter((quote: any) => quote.status === 'Rejected');
  const completedRequests = requests.filter((request: any) => request.status === 'Completed');
  const overdueTasks = tasks.filter((task: any) => task.status !== 'Completed' && asDate(task.endAt).getTime() < Date.now());

  const salesPerformance = users
    .filter((user: any) => user.rank === 3 || user.rank >= 4)
    .map((user: any) => {
      const userLeads = leads.filter((lead: any) => lead.assignedTo === user._id);
      const userQuotes = quotes.filter((quote: any) => quote.creatorId === user._id);
      const userOpps = opportunities.filter((opp: any) => opp.assignedTo === user._id);
      return {
        userId: user._id,
        name: user.name,
        zone: user.zone || '-',
        leads: userLeads.length,
        quotes: userQuotes.length,
        won: userOpps.filter((opp: any) => opp.stage === 'Won').length,
        wonValue: userOpps.filter((opp: any) => opp.stage === 'Won').reduce((sum: number, opp: any) => sum + Number(opp.value || 0), 0)
      };
    })
    .filter((row: any) => row.leads || row.quotes || row.won);

  const requestSlaRows = requests.map((request: any) => ({
    requestNumber: request.requestNumber,
    title: request.title,
    department: request.targetDepartment,
    priority: request.priority || 'Medium',
    status: request.status,
    slaDueAt: request.slaDueAt,
    breached: request.slaDueAt ? asDate(request.slaDueAt).getTime() < Date.now() && request.status !== 'Completed' : false
  }));
  const salesForecast = opportunities
    .filter((opp: any) => !['Won', 'Lost'].includes(opp.stage))
    .reduce((acc: any[], opp: any) => {
      const owner = userMap.get(opp.assignedTo);
      const ownerId = opp.assignedTo || 'unassigned';
      const existing = acc.find(row => row.ownerId === ownerId);
      const probability = Number(opp.probability ?? 50) / 100;
      const weightedForecast = Number(opp.value || 0) * probability;
      if (existing) {
        existing.pipelineValue += Number(opp.value || 0);
        existing.weightedForecast += weightedForecast;
        existing.dealCount += 1;
      } else {
        acc.push({
          ownerId,
          ownerName: owner?.name || 'Unassigned',
          zone: owner?.zone || '-',
          pipelineValue: Number(opp.value || 0),
          weightedForecast,
          dealCount: 1
        });
      }
      return acc;
    }, [])
    .sort((a: any, b: any) => b.weightedForecast - a.weightedForecast);

  res.json({
    scope: currentUser.rank >= 4 ? 'team' : 'personal',
    dateFrom: req.query.dateFrom || null,
    dateTo: req.query.dateTo || null,
    metrics: {
      leads: leads.length,
      opportunities: opportunities.length,
      quotes: quotes.length,
      wonDeals: wonOpps.length,
      wonValue: wonOpps.reduce((sum: number, opp: any) => sum + Number(opp.value || 0), 0),
      requestSlaBreached: requestSlaRows.filter((row: any) => row.breached).length,
      overdueTasks: overdueTasks.length
    },
    funnel: {
      leads: leads.length,
      opportunities: opportunities.length,
      quotes: quotes.length,
      won: wonOpps.length
    },
    quoteApproval: {
      approved: approvedQuotes.length,
      pending: pendingQuotes.length,
      rejected: rejectedQuotes.length,
      approvedValue: approvedQuotes.reduce((sum: number, quote: any) => sum + Number(quote.totalAmount || 0), 0),
      averageApprovalHours: approvedQuotes.length
        ? approvedQuotes.reduce((sum: number, quote: any) => sum + Math.max(0, asDate(quote.updatedAt).getTime() - asDate(quote.createdAt).getTime()) / 3600000, 0) / approvedQuotes.length
        : 0
    },
    requestSla: {
      rows: requestSlaRows,
      completed: completedRequests.length,
      breached: requestSlaRows.filter((row: any) => row.breached).length
    },
    taskReport: {
      completed: tasks.filter((task: any) => task.status === 'Completed').length,
      overdue: overdueTasks.length,
      total: tasks.length
    },
    salesForecast,
    salesPerformance
  });
});

// ------------------------------------------------------------------------------
// LEADS & SCHOOLS
// ------------------------------------------------------------------------------
app.get('/api/leads', requirePermission('manageLeads'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // Retrieve leads – works with both mock MemoryCollection (returns array) and MongoDB Collection (returns cursor)
  let leadsArray = await findAll<any>(Leads());
  const {
    search = '',
    zone = 'All',
    status = 'All',
    assignedTo = 'All',
    minScore,
    maxScore,
    includeArchived = 'false'
  } = req.query;
  const searchText = String(search).trim().toLowerCase();
  leadsArray = leadsArray.filter(lead => {
    if (includeArchived !== 'true' && lead.archived) return false;
    if (searchText) {
      const haystack = [lead.schoolName, lead.address, lead.zone, lead.source, lead.campaign]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchText)) return false;
    }
    if (zone !== 'All' && lead.zone !== zone) return false;
    if (status !== 'All' && lead.status !== status) return false;
    if (assignedTo !== 'All' && lead.assignedTo !== assignedTo) return false;
    if (minScore !== undefined && lead.score < Number(minScore)) return false;
    if (maxScore !== undefined && lead.score > Number(maxScore)) return false;
    return true;
  });

  // Filter leads based on Sales zone if current user is Sales (rank 3)
  if (currentUser.rank === 3) {
    const userZone = currentUser.zone || '';
    const filteredLeads = leadsArray.filter(l => l.assignedTo === currentUser._id || l.zone === userZone);
    res.json(filteredLeads.map(hydrateLeadForResponse));
    return;
  }

  res.json(leadsArray.map(hydrateLeadForResponse));
});

app.get('/api/leads/export.csv', requirePermission('manageLeads'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const users = await findAll<any>(Users());
  const userMap = new Map(users.map(user => [user._id, user]));
  const allLeads = (await findAll<any>(Leads())).filter(lead => !lead.archived && userCanSeeLead(currentUser, lead));
  const escapeCsv = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['schoolName', 'address', 'zone', 'status', 'stage', 'score', 'gradeLevels', 'educationAuthority', 'district', 'province', 'studentCount', 'upperElementaryStudentCount', 'lastContactedAt', 'nextCallAt', 'documentStatus', 'remarks', 'legacySaleName', 'source', 'campaign', 'assignedTo', 'contacts'].join(','),
    ...allLeads.map(lead => [
      lead.schoolName,
      lead.address,
      lead.zone,
      lead.status,
      lead.stage || 'New Lead',
      lead.score,
      lead.gradeLevels,
      lead.educationAuthority,
      lead.district,
      lead.province,
      lead.studentCount,
      lead.upperElementaryStudentCount,
      lead.lastContactedAt,
      lead.nextCallAt,
      lead.documentStatus,
      lead.remarks,
      lead.legacySaleName,
      lead.source,
      lead.campaign,
      userMap.get(lead.assignedTo)?.name || lead.assignedTo,
      (lead.contacts || []).map((contact: any) => `${contact.name}:${contact.phone || contact.email || ''}`).join('; ')
    ].map(escapeCsv).join(','))
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="nextgen-leads.csv"');
  res.send(`\uFEFF${rows.join('\n')}`);
});

function parseCsvLine(line: string) {
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

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function colToIndex(col: string) {
  return col.split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
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

function parseXlsxRows(buffer: Buffer) {
  const sharedStringsXml = readZipEntry(buffer, 'xl/sharedStrings.xml');
  const sheetXml = readZipEntry(buffer, 'xl/worksheets/sheet1.xml');
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = parseWorksheetRows(sheetXml, sharedStrings);
  if (rows.length < 2) return [] as Record<string, string>[];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const mapped: Record<string, string> = {};
    Object.entries(row).forEach(([col, value]) => {
      mapped[`__col_${col}`] = value;
    });
    Object.entries(headers).forEach(([col, header]) => {
      if (header) mapped[header] = row[col] || '';
    });
    return mapped;
  });
}

function excelSerialToDateText(value?: string) {
  if (!value || value === '-') return '';
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial < 30000) return value;
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return date.toISOString().slice(0, 10);
}

function numberFromImportCell(value?: string) {
  const cleaned = String(value || '').replace(/,/g, '').trim();
  if (!cleaned || cleaned === '-') return undefined;
  const numberValue = Number(cleaned);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function provinceToZone(province?: string) {
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

function mapLegacyStepToLeadStage(step?: string) {
  const value = String(step || '').toLowerCase();
  if (!value) return 'New Lead';
  if (value.includes('ปิดกิจการ') || value.includes('ไม่สนใจ') || value.includes('closed lost')) return 'Closed Lost';
  if (value.includes('won') || value.includes('ปิดการขาย')) return 'Closed Won';
  if (value.includes('trial') || value.includes('pilot') || value.includes('ทดลอง')) return 'Pilot/Trial';
  if (value.includes('proposal') || value.includes('เสนอราคา')) return 'Proposal Sent';
  if (value.includes('present') || value.includes('พรีเซน') || value.includes('demo') || value.includes('สาธิต')) return 'Demo Scheduled';
  if (value.includes('สนใจ')) return 'Interested';
  if (value.includes('โทร') || value.includes('ติดต่อ') || value.includes('ยื่น') || value.includes('email') || value.includes('อีเมล')) return 'Contacted';
  return 'New Lead';
}

function normalizeLeadStatus(status?: string, stage?: string) {
  const raw = String(status || '').trim();
  if (['Cold', 'Warm', 'Hot', 'Customer'].includes(raw)) return raw;
  const mappedStage = mapLegacyStepToLeadStage(stage);
  if (mappedStage === 'Closed Won') return 'Customer';
  if (['Demo Scheduled', 'Proposal Sent', 'Pilot/Trial'].includes(mappedStage)) return 'Hot';
  if (['Contacted', 'Interested'].includes(mappedStage)) return 'Warm';
  return 'Cold';
}

function emailFromCell(value?: string) {
  return String(value || '').replace(/^mailto:/i, '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function buildLeadFromImportRow(row: Record<string, string>, index: number, currentUserId: string) {
  const schoolName = row.schoolName || row.name || row['รายชื่อโรงเรียน'];
  const district = row['เขต'] || row.district || '';
  const province = row['จังหวัด'] || row.province || '';
  const legacyStep = row.stage || row['อยู่ในขั้นตอน'];
  const stage = ['New Lead', 'Contacted', 'Interested', 'Demo Scheduled', 'Proposal Sent', 'Pilot/Trial', 'Closed Won', 'Closed Lost'].includes(legacyStep)
    ? legacyStep
    : mapLegacyStepToLeadStage(legacyStep);
  const status = normalizeLeadStatus(row.status || row['สถานะ'], legacyStep);
  const emailCell = row.email || row.contactEmail || row['อีเมล'];
  const email = emailFromCell(emailCell);
  const phone = row.phone || row.contactPhone || row['เบอร์โทร'] || '';
  const contactName = row.contactName || row['ผู้ติดต่อ'] || row.__col_P || '';
  const noteParts = [
    row['ระดับชั้น'] ? `ระดับชั้น: ${row['ระดับชั้น']}` : '',
    row['จำนวน นร.'] ? `จำนวน นร.: ${row['จำนวน นร.']}` : '',
    row['จำนวน นร. ป.4-6'] ? `จำนวน นร. ป.4-6: ${row['จำนวน นร. ป.4-6']}` : '',
    legacyStep ? `ขั้นตอนเดิม: ${legacyStep}` : '',
    row['ติดต่อลูกค้าล่าสุด'] ? `ติดต่อล่าสุด: ${excelSerialToDateText(row['ติดต่อลูกค้าล่าสุด'])}` : '',
    row['นัดโทรครั้งถัดไป'] ? `นัดโทรครั้งถัดไป: ${excelSerialToDateText(row['นัดโทรครั้งถัดไป'])}` : '',
    row['Ps / ยื่นหนังสือ'] ? `Ps/ยื่นหนังสือ: ${row['Ps / ยื่นหนังสือ']}` : '',
    row.Remarks ? `Remarks: ${row.Remarks}` : '',
    (row.Sale || row.__col_Q) ? `Sale เดิม: ${row.Sale || row.__col_Q}` : '',
    emailCell && !email ? `ข้อมูลช่องอีเมล: ${emailCell}` : '',
    contactName ? `ข้อมูลเพิ่มเติม: ${contactName}` : ''
  ].filter(Boolean);

  return {
    _id: `l_import_${Date.now()}_${index}`,
    schoolName,
    address: [district, province].filter(Boolean).join(' '),
    zone: row.zone || provinceToZone(province),
    status,
    stage,
    score: status === 'Hot' ? 85 : status === 'Warm' ? 60 : status === 'Customer' ? 100 : stage === 'Closed Lost' ? 0 : 10,
    gradeLevels: row.gradeLevels || row['ระดับชั้น'] || undefined,
    educationAuthority: row.educationAuthority || row.__col_C || undefined,
    district: district || undefined,
    province: province || undefined,
    studentCount: numberFromImportCell(row.studentCount || row['จำนวน นร.']),
    upperElementaryStudentCount: numberFromImportCell(row.upperElementaryStudentCount || row['จำนวน นร. ป.4-6']),
    lastContactedAt: excelSerialToDateText(row.lastContactedAt || row['ติดต่อลูกค้าล่าสุด']) || undefined,
    nextCallAt: excelSerialToDateText(row.nextCallAt || row['นัดโทรครั้งถัดไป']) || undefined,
    documentStatus: row.documentStatus || row['Ps / ยื่นหนังสือ'] || undefined,
    remarks: row.remarks || row.Remarks || undefined,
    legacySaleName: row.legacySaleName || row.Sale || row.__col_Q || undefined,
    source: row.source || 'Excel Import',
    campaign: row.campaign || 'สรุปรายชื่อโรงเรียนกำลังดำเนินการ',
    archived: stage === 'Closed Lost' && String(legacyStep || '').includes('ปิดกิจการ'),
    contacts: phone || email || contactName ? [{
      name: contactName || row.Sale || row.__col_Q || 'ผู้ติดต่อจากไฟล์นำเข้า',
      position: emailCell && !email ? emailCell : '',
      phone,
      email
    }] : [],
    assignedTo: currentUserId,
    assignmentHistory: [{
      toUserId: currentUserId,
      changedBy: currentUserId,
      reason: 'Excel import',
      changedAt: new Date()
    }],
    notes: noteParts.length ? [{
      author: 'Excel Import',
      content: noteParts.join('\n'),
      type: 'General',
      createdAt: new Date()
    }] : [],
    attachments: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

app.post('/api/leads/import.csv', requirePermission('manageLeads'), express.raw({ type: ['text/csv', 'text/plain', 'application/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'], limit: '10mb' }), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''));
  if (!bodyBuffer.length) {
    res.status(400).json({ message: 'ไฟล์ว่างหรืออ่านไม่ได้' });
    return;
  }

  let rows: Record<string, string>[] = [];
  const isXlsx = bodyBuffer.subarray(0, 2).toString('utf8') === 'PK'
    || String(req.headers['content-type'] || '').includes('spreadsheetml');

  if (isXlsx) {
    rows = parseXlsxRows(bodyBuffer);
  } else {
    const csvText = bodyBuffer.toString('utf8').replace(/^\uFEFF/, '').trim();
    if (!csvText) {
      res.status(400).json({ message: 'CSV ว่างหรืออ่านไม่ได้' });
      return;
    }
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines[0]).map(header => header.trim());
    rows = lines.slice(1).map(line => {
      const cells = parseCsvLine(line);
      return headers.reduce((acc, header, index) => ({ ...acc, [header]: cells[index] || '' }), {} as Record<string, string>);
    });
  }

  const existingLeads = await findAll<any>(Leads());
  const imported: any[] = [];
  const updated: any[] = [];
  const skipped: any[] = [];

  for (const [index, row] of rows.entries()) {
    const leadDraft = buildLeadFromImportRow(row, index, currentUser._id);
    if (!leadDraft.schoolName) {
      skipped.push({ reason: 'missing_schoolName', row });
      continue;
    }
    const duplicates = findLeadDuplicates([...existingLeads, ...imported], leadDraft);
    if (duplicates.length > 0) {
      const existingDuplicate = existingLeads.find(item => duplicates.some(duplicate => duplicate._id === item._id));
      if (existingDuplicate) {
        const enrichedLead = {
          ...existingDuplicate,
          schoolName: leadDraft.schoolName || existingDuplicate.schoolName,
          address: leadDraft.address || existingDuplicate.address,
          zone: leadDraft.zone || existingDuplicate.zone,
          status: leadDraft.status || existingDuplicate.status,
          stage: leadDraft.stage || existingDuplicate.stage || 'New Lead',
          score: leadDraft.score !== undefined ? leadDraft.score : existingDuplicate.score,
          gradeLevels: leadDraft.gradeLevels ?? existingDuplicate.gradeLevels,
          educationAuthority: leadDraft.educationAuthority ?? existingDuplicate.educationAuthority,
          district: leadDraft.district ?? existingDuplicate.district,
          province: leadDraft.province ?? existingDuplicate.province,
          studentCount: leadDraft.studentCount ?? existingDuplicate.studentCount,
          upperElementaryStudentCount: leadDraft.upperElementaryStudentCount ?? existingDuplicate.upperElementaryStudentCount,
          lastContactedAt: leadDraft.lastContactedAt ?? existingDuplicate.lastContactedAt,
          nextCallAt: leadDraft.nextCallAt ?? existingDuplicate.nextCallAt,
          documentStatus: leadDraft.documentStatus ?? existingDuplicate.documentStatus,
          remarks: leadDraft.remarks ?? existingDuplicate.remarks,
          legacySaleName: leadDraft.legacySaleName ?? existingDuplicate.legacySaleName,
          source: leadDraft.source || existingDuplicate.source,
          campaign: leadDraft.campaign || existingDuplicate.campaign,
          contacts: (leadDraft.contacts || []).length ? leadDraft.contacts : existingDuplicate.contacts,
          notes: existingDuplicate.notes || [],
          updatedAt: new Date()
        };
        if ('insertOne' in Leads() && !(Leads() instanceof MemoryCollection)) {
          await (Leads() as any).updateOne({ _id: existingDuplicate._id }, { $set: enrichedLead });
        } else {
          const idx = (MemoryStore as any).leads.findIndex((item: any) => item._id === existingDuplicate._id);
          if (idx !== -1) (MemoryStore as any).leads[idx] = enrichedLead;
        }
        updated.push({ _id: existingDuplicate._id, schoolName: enrichedLead.schoolName });
      } else {
        skipped.push({ reason: 'duplicate', schoolName: leadDraft.schoolName, duplicates });
      }
      continue;
    }
    imported.push(leadDraft);
  }

  await Promise.all(imported.map(lead => Leads().insertOne(lead as any)));
  await createAuditLog(req, currentUser, isXlsx ? 'lead.import_xlsx' : 'lead.import_csv', 'lead', {}, { imported: imported.length, updated: updated.length, skipped: skipped.length });
  res.status(201).json({ imported: imported.length, updated: updated.length, skipped, format: isXlsx ? 'xlsx' : 'csv' });
});

app.get('/api/leads/:id', requirePermission('manageLeads'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const lead = await Leads().findOne({ _id: req.params.id } as any);
  if (!lead || !userCanSeeLead(currentUser, lead)) {
    res.status(404).json({ message: 'ไม่พบข้อมูลโรงเรียน' });
    return;
  }
  res.json(hydrateLeadForResponse(lead));
});

app.post('/api/leads', requirePermission('manageLeads'), validateBody(createLeadBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const {
    schoolName,
    address,
    zone,
    status,
    stage,
    score,
    gradeLevels,
    educationAuthority,
    district,
    province,
    studentCount,
    upperElementaryStudentCount,
    lastContactedAt,
    nextCallAt,
    documentStatus,
    remarks,
    legacySaleName,
    source,
    campaign,
    assignedTo,
    contacts,
    attachments
  } = req.body;
  const duplicateLeads = findLeadDuplicates(await findAll<any>(Leads()), { schoolName, contacts });
  if (duplicateLeads.length > 0) {
    res.status(409).json({ message: 'พบข้อมูลโรงเรียนหรือผู้ติดต่อซ้ำในระบบ', duplicates: duplicateLeads });
    return;
  }
  const ownerId = assignedTo || currentUser._id;
  const newLead = {
    _id: `l_${Date.now()}`,
    schoolName,
    address,
    zone,
    status: status || 'Cold',
    stage: stage || 'New Lead',
    score: Number(score) || 10,
    gradeLevels,
    educationAuthority,
    district,
    province,
    studentCount,
    upperElementaryStudentCount,
    lastContactedAt,
    nextCallAt,
    documentStatus,
    remarks,
    legacySaleName,
    source,
    campaign,
    archived: false,
    contacts: contacts || [],
    assignedTo: ownerId,
    assignmentHistory: [{
      toUserId: ownerId,
      changedBy: currentUser._id,
      reason: 'Initial owner',
      changedAt: new Date()
    }],
    notes: [],
    attachments: attachments || [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await Leads().insertOne(newLead as any);
  res.status(201).json(newLead);
});

app.put('/api/leads/:id', requirePermission('manageLeads'), validateBody(updateLeadBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const leadsColl = Leads();
  const lead = await leadsColl.findOne({ _id: req.params.id } as any);
  if (!lead) {
    res.status(404).json({ message: 'ไม่พบข้อมูลโรงเรียน' });
    return;
  }

  const {
    schoolName,
    address,
    zone,
    status,
    stage,
    score,
    gradeLevels,
    educationAuthority,
    district,
    province,
    studentCount,
    upperElementaryStudentCount,
    lastContactedAt,
    nextCallAt,
    documentStatus,
    remarks,
    legacySaleName,
    notes,
    contacts,
    assignedTo,
    transferReason,
    source,
    campaign,
    archived,
    attachments
  } = req.body;
  if (!userCanSeeLead(currentUser, lead)) {
    res.status(404).json({ message: 'ไม่พบข้อมูลโรงเรียน' });
    return;
  }
  if (contacts) {
    const duplicateLeads = findLeadDuplicates(await findAll<any>(Leads()), { schoolName: lead.schoolName, contacts }, lead._id);
    if (duplicateLeads.length > 0) {
      res.status(409).json({ message: 'พบข้อมูลผู้ติดต่อซ้ำในระบบ', duplicates: duplicateLeads });
      return;
    }
  }
  const isTransfer = assignedTo && assignedTo !== lead.assignedTo;
  const assignmentHistory = isTransfer
    ? [
        ...(lead.assignmentHistory || []),
        {
          fromUserId: lead.assignedTo,
          toUserId: assignedTo,
          changedBy: currentUser._id,
          reason: transferReason,
          changedAt: new Date()
        }
      ]
    : lead.assignmentHistory;
  const updatedLead = {
    ...lead,
    schoolName: schoolName !== undefined ? schoolName : lead.schoolName,
    address: address !== undefined ? address : lead.address,
    zone: zone !== undefined ? zone : lead.zone,
    status: status || lead.status,
    stage: stage || lead.stage || 'New Lead',
    score: score !== undefined ? Number(score) : lead.score,
    gradeLevels: gradeLevels !== undefined ? gradeLevels : lead.gradeLevels,
    educationAuthority: educationAuthority !== undefined ? educationAuthority : lead.educationAuthority,
    district: district !== undefined ? district : lead.district,
    province: province !== undefined ? province : lead.province,
    studentCount: studentCount !== undefined ? Number(studentCount) : lead.studentCount,
    upperElementaryStudentCount: upperElementaryStudentCount !== undefined ? Number(upperElementaryStudentCount) : lead.upperElementaryStudentCount,
    lastContactedAt: lastContactedAt !== undefined ? lastContactedAt : lead.lastContactedAt,
    nextCallAt: nextCallAt !== undefined ? nextCallAt : lead.nextCallAt,
    documentStatus: documentStatus !== undefined ? documentStatus : lead.documentStatus,
    remarks: remarks !== undefined ? remarks : lead.remarks,
    legacySaleName: legacySaleName !== undefined ? legacySaleName : lead.legacySaleName,
    source: source !== undefined ? source : lead.source,
    campaign: campaign !== undefined ? campaign : lead.campaign,
    assignedTo: assignedTo || lead.assignedTo,
    assignmentHistory,
    archived: archived !== undefined ? archived : lead.archived,
    contacts: contacts || lead.contacts,
    notes: notes ? [...lead.notes, ...notes.map((note: any) => ({ ...note, createdAt: note.createdAt || new Date() }))] : lead.notes,
    attachments: attachments || lead.attachments || [],
    updatedAt: new Date()
  };

  // Workaround since our memory driver only has insert/find
  if ('insertOne' in leadsColl && !(leadsColl instanceof MemoryCollection)) {
    await (leadsColl as any).updateOne({ _id: req.params.id }, { $set: updatedLead });
  } else {
    // Memory override helper
    const store = (Leads() as any).find ? (Leads() as any) : null;
    if (store) {
      const idx = (MemoryStore as any).leads.findIndex((item: any) => item._id === req.params.id);
      if (idx !== -1) (MemoryStore as any).leads[idx] = updatedLead;
    }
  }

  res.json(hydrateLeadForResponse(updatedLead));
});

app.get('/api/leads/:id/activity', requirePermission('manageLeads'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const lead = await Leads().findOne({ _id: req.params.id } as any);
  if (!lead || !userCanSeeLead(currentUser, lead)) {
    res.status(404).json({ message: 'ไม่พบข้อมูลโรงเรียน' });
    return;
  }

  const [tasks, quotes, requests, opportunities, users] = await Promise.all([
    findAll<any>(Tasks(), { leadId: lead._id }),
    findAll<any>(Quotations(), { leadId: lead._id }),
    findAll<any>(Requests(), { leadId: lead._id }),
    findAll<any>(Opportunities(), { leadId: lead._id }),
    findAll<any>(Users())
  ]);
  const userMap = new Map(users.map(user => [user._id, user]));
  const activities = [
    ...(lead.notes || []).map((note: any) => ({
      _id: `note_${note.createdAt}_${note.content}`,
      type: note.type || (String(note.content || '').startsWith('[Coaching]') ? 'Coaching' : 'Note'),
      title: note.type ? `${note.type} note` : 'Lead note',
      description: note.content,
      actorName: note.author,
      createdAt: note.createdAt
    })),
    ...(lead.assignmentHistory || []).map((item: any) => ({
      _id: `assign_${item.changedAt}`,
      type: 'Assignment',
      title: 'Owner changed',
      description: `${userMap.get(item.fromUserId)?.name || 'Unassigned'} -> ${userMap.get(item.toUserId)?.name || item.toUserId}${item.reason ? `: ${item.reason}` : ''}`,
      actorName: userMap.get(item.changedBy)?.name || item.changedBy,
      createdAt: item.changedAt
    })),
    ...tasks.map(task => ({
      _id: task._id,
      type: 'Task',
      title: task.title,
      description: task.description || task.status,
      actorName: userMap.get(task.creatorId)?.name || task.creatorId,
      createdAt: task.createdAt || task.startAt
    })),
    ...quotes.map(quote => ({
      _id: quote._id,
      type: 'Quote',
      title: quote.quoteNumber,
      description: `${quote.status} · ${quote.totalAmount || 0}`,
      actorName: userMap.get(quote.creatorId)?.name || quote.creatorId,
      createdAt: quote.createdAt
    })),
    ...requests.map(requestItem => ({
      _id: requestItem._id,
      type: 'Request',
      title: requestItem.requestNumber || requestItem.title,
      description: `${requestItem.status} · ${requestItem.title}`,
      actorName: userMap.get(requestItem.creatorId)?.name || requestItem.creatorId,
      createdAt: requestItem.createdAt
    })),
    ...opportunities.map(opportunity => ({
      _id: opportunity._id,
      type: 'Opportunity',
      title: opportunity.title,
      description: `${opportunity.stage} · ${opportunity.value || 0}`,
      actorName: userMap.get(opportunity.assignedTo)?.name || opportunity.assignedTo,
      createdAt: opportunity.createdAt
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(activities);
});

app.delete('/api/leads/:id', requirePermission('manageLeads'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const leadColl = Leads();
  const lead = await leadColl.findOne({ _id: req.params.id } as any);
  if (!lead || !userCanSeeLead(currentUser, lead)) {
    res.status(404).json({ message: 'ไม่พบข้อมูลโรงเรียน' });
    return;
  }
  const updatedLead = { ...lead, archived: true, updatedAt: new Date() };
  await (leadColl as any).updateOne({ _id: req.params.id }, { $set: updatedLead });
  await createAuditLog(req, currentUser, 'lead.archive', 'lead', updatedLead, { before: lead, after: updatedLead });
  res.json(updatedLead);
});

app.post('/api/leads/:id/ai-coach', requirePermission('useAIChat'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  if (!(await canUseAIChat(currentUser))) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ใช้งาน AI Coach' });
    return;
  }
  const lead = await Leads().findOne({ _id: req.params.id } as any);
  if (!lead) {
    res.status(404).json({ message: 'ไม่พบข้อมูลโรงเรียน' });
    return;
  }

  const suggestions = await getAICoachSuggestions(lead);
  res.json({ suggestions });
});

// Memory class placeholder helper
class MemoryCollection<T> {}

// ------------------------------------------------------------------------------
// OPPORTUNITIES
// ------------------------------------------------------------------------------
function userCanSeeOpportunity(user: any, opportunity: any) {
  if (!user || !opportunity) return false;
  if (user.rank >= 4 || isRootAdmin(user)) return true;
  return opportunity.assignedTo === user._id;
}

function defaultProbabilityForStage(stage: string) {
  if (stage === 'Qualified') return 20;
  if (stage === 'Proposal') return 40;
  if (stage === 'Demo') return 55;
  if (stage === 'Negotiation') return 75;
  if (stage === 'Won') return 100;
  if (stage === 'Lost') return 0;
  return 20;
}

app.get('/api/opportunities', requirePermission('managePipeline'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const opps = await findAll<any>(Opportunities());
  if (currentUser.rank === 3) {
    const filtered = opps.filter(o => o.assignedTo === currentUser._id);
    res.json(filtered);
    return;
  }

  res.json(opps);
});

app.get('/api/opportunities/forecast', requirePermission('managePipeline'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const [opps, users] = await Promise.all([findAll<any>(Opportunities()), findAll<any>(Users())]);
  const visibleOpps = opps.filter(opp => userCanSeeOpportunity(currentUser, opp));
  const userMap = new Map(users.map(user => [user._id, user]));
  const summary = visibleOpps.reduce((acc: Record<string, any>, opp) => {
    const close = asDate(opp.closeDate);
    const month = `${close.getFullYear()}-${String(close.getMonth() + 1).padStart(2, '0')}`;
    const owner = userMap.get(opp.assignedTo);
    const ownerKey = `${month}|${opp.assignedTo}`;
    const weightedValue = (Number(opp.value) || 0) * ((Number(opp.probability) || defaultProbabilityForStage(opp.stage)) / 100);
    acc[ownerKey] = acc[ownerKey] || {
      month,
      ownerId: opp.assignedTo,
      ownerName: owner?.name || opp.assignedTo,
      dealCount: 0,
      pipelineValue: 0,
      weightedForecast: 0,
      wonValue: 0
    };
    acc[ownerKey].dealCount += 1;
    acc[ownerKey].pipelineValue += Number(opp.value) || 0;
    acc[ownerKey].weightedForecast += weightedValue;
    if (opp.stage === 'Won') acc[ownerKey].wonValue += Number(opp.value) || 0;
    return acc;
  }, {});
  res.json(Object.values(summary).sort((a: any, b: any) => `${a.month}${a.ownerName}`.localeCompare(`${b.month}${b.ownerName}`)));
});

app.get('/api/opportunities/:id', requirePermission('managePipeline'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const opp = await Opportunities().findOne({ _id: req.params.id } as any);
  if (!opp || !userCanSeeOpportunity(currentUser, opp)) {
    res.status(404).json({ message: 'ไม่พบโอกาสการขาย' });
    return;
  }
  const [lead, quotes, owner] = await Promise.all([
    Leads().findOne({ _id: opp.leadId } as any),
    findAll<any>(Quotations(), { leadId: opp.leadId }),
    Users().findOne({ _id: opp.assignedTo } as any)
  ]);
  res.json({ ...opp, lead, quotes, owner: sanitizeUser(owner) });
});

app.post('/api/opportunities', requirePermission('managePipeline'), validateBody(createOpportunityBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { leadId, title, value, closeDate, stage, assignedTo, probability, quoteIds } = req.body;
  const lead = await Leads().findOne({ _id: leadId } as any);
  if (!lead || !userCanSeeLead(currentUser, lead)) {
    res.status(404).json({ message: 'ไม่พบข้อมูลโรงเรียน' });
    return;
  }
  const ownerId = assignedTo || currentUser._id;
  const newOpp = {
    _id: `o_${Date.now()}`,
    leadId,
    title,
    stage: stage || 'Qualified',
    value: Number(value) || 0,
    closeDate: new Date(closeDate),
    assignedTo: ownerId,
    probability: probability ?? defaultProbabilityForStage(stage || 'Qualified'),
    quoteIds: quoteIds || [],
    stageHistory: [{
      toStage: stage || 'Qualified',
      changedBy: currentUser._id,
      reason: 'Created opportunity',
      changedAt: new Date()
    }],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await Opportunities().insertOne(newOpp as any);
  await createAuditLog(req, currentUser, 'opportunity.create', 'opportunity', newOpp);
  res.status(201).json(newOpp);
});

app.put('/api/opportunities/:id', requirePermission('managePipeline'), validateBody(updateOpportunityBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const oppsColl = Opportunities();
  const opp = await oppsColl.findOne({ _id: req.params.id } as any);
  if (!opp || !userCanSeeOpportunity(currentUser, opp)) {
    res.status(404).json({ message: 'ไม่พบโอกาสการขาย' });
    return;
  }
  if (req.body.closeDate && new Date(req.body.closeDate).getTime() < new Date(new Date().toDateString()).getTime()) {
    res.status(400).json({ message: 'วันที่คาดว่าจะปิดการขายต้องไม่เป็นวันในอดีต' });
    return;
  }
  const updateData = {
    ...req.body,
    closeDate: req.body.closeDate ? new Date(req.body.closeDate) : opp.closeDate,
    updatedAt: new Date()
  };
  const updatedOpp = { ...opp, ...updateData };
  await (oppsColl as any).updateOne({ _id: req.params.id }, { $set: updatedOpp });
  await createAuditLog(req, currentUser, 'opportunity.update', 'opportunity', updatedOpp, { before: opp, after: updatedOpp });
  res.json(updatedOpp);
});

app.put('/api/opportunities/:id/stage', requirePermission('managePipeline'), validateBody(opportunityStageBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const oppsColl = Opportunities();
  const opp = await oppsColl.findOne({ _id: req.params.id } as any);
  if (!opp || !userCanSeeOpportunity(currentUser, opp)) {
    res.status(404).json({ message: 'ไม่พบโอกาสการขาย' });
    return;
  }

  const { stage, reason, lostReason, probability } = req.body;
  const stageHistory = [
    ...(opp.stageHistory || []),
    {
      fromStage: opp.stage,
      toStage: stage,
      changedBy: currentUser._id,
      reason: stage === 'Lost' ? lostReason || reason : reason,
      changedAt: new Date()
    }
  ];
  const updatedOpp = {
    ...opp,
    stage,
    probability: probability ?? defaultProbabilityForStage(stage),
    lostReason: stage === 'Lost' ? lostReason || reason : undefined,
    stageHistory,
    updatedAt: new Date()
  };

  if ('updateOne' in oppsColl) {
    await (oppsColl as any).updateOne({ _id: req.params.id }, { $set: updatedOpp });
  } else {
    const idx = (MemoryStore as any).opportunities.findIndex((item: any) => item._id === req.params.id);
    if (idx !== -1) (MemoryStore as any).opportunities[idx] = updatedOpp;
  }

  await createAuditLog(req, currentUser, 'opportunity.stage_change', 'opportunity', updatedOpp, {
    before: { stage: opp.stage, probability: opp.probability },
    after: { stage: updatedOpp.stage, probability: updatedOpp.probability },
    reason: stage === 'Lost' ? lostReason || reason : reason
  });
  res.json(updatedOpp);
});

// ------------------------------------------------------------------------------
// TASKS & APPOINTMENTS
// ------------------------------------------------------------------------------
function userCanSeeTask(user: any, task: any) {
  if (!user || !task) return false;
  if (user.rank >= 4 || isRootAdmin(user)) return true;
  return task.creatorId === user._id || task.participants?.some((participant: any) => participant.userId === user._id);
}

function findTaskConflicts(tasks: any[], participantIds: string[], startAt: Date, endAt: Date, excludeTaskId?: string) {
  return tasks
    .filter(task => task._id !== excludeTaskId)
    .filter(task => doTimeRangesOverlap({ startAt: task.startAt, endAt: task.endAt }, { startAt, endAt }))
    .filter(task => {
      const taskUsers = new Set([task.creatorId, ...(task.participants || []).map((participant: any) => participant.userId)]);
      return participantIds.some(id => taskUsers.has(id));
    })
    .map(task => ({
      _id: task._id,
      title: task.title,
      startAt: task.startAt,
      endAt: task.endAt,
      users: [task.creatorId, ...(task.participants || []).map((participant: any) => participant.userId)].filter((id: string) => participantIds.includes(id))
    }));
}

function addRecurrenceDate(date: Date, rule: string, index: number) {
  const result = new Date(date);
  if (rule === 'daily') result.setDate(result.getDate() + index);
  if (rule === 'weekly') result.setDate(result.getDate() + (index * 7));
  if (rule === 'monthly') result.setMonth(result.getMonth() + index);
  return result;
}

function calculateReminderAt(startAt: Date, minutesBefore?: number) {
  if (minutesBefore === undefined) return undefined;
  return new Date(startAt.getTime() - minutesBefore * 60 * 1000);
}

function formatIcsDate(value: any) {
  return asDate(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

app.get('/api/tasks', requirePermission('manageTasks'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const tasks = await findAll<any>(Tasks());
  const filtered = tasks.filter(task => userCanSeeTask(currentUser, task));

  res.json(filtered);
});

app.get('/api/tasks/export.ics', requirePermission('manageTasks'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const tasks = (await findAll<any>(Tasks())).filter(task => userCanSeeTask(currentUser, task));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NEXTGEN//Sale Support Calendar//TH',
    ...tasks.flatMap(task => [
      'BEGIN:VEVENT',
      `UID:${task._id}@nextgen-sale-support`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(task.startAt)}`,
      `DTEND:${formatIcsDate(task.endAt)}`,
      `SUMMARY:${String(task.title || '').replace(/\n/g, ' ')}`,
      `DESCRIPTION:${String(task.description || '').replace(/\n/g, '\\n')}`,
      'END:VEVENT'
    ]),
    'END:VCALENDAR'
  ];
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="nextgen-calendar.ics"');
  res.send(lines.join('\r\n'));
});

app.post('/api/tasks/conflicts', requirePermission('manageTasks'), validateBody(taskConflictBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const start = new Date(req.body.startAt);
  const end = new Date(req.body.endAt);
  const participantIds = Array.from(new Set([currentUser._id, ...(req.body.participantIds || [])]));
  const conflicts = findTaskConflicts(await findAll<any>(Tasks()), participantIds, start, end);
  res.json({ hasConflict: conflicts.length > 0, conflicts });
});

app.post('/api/tasks', requirePermission('manageTasks'), validateBody(createTaskBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { title, description, type, startAt, endAt, leadId, opportunityId, requestId, participantIds, reminderMinutesBefore, recurrenceRule, recurrenceCount } = req.body;
  const taskStart = new Date(startAt);
  const taskEnd = new Date(endAt);
  const uniqueParticipantIds = Array.from(new Set([currentUser._id, ...(participantIds || [])]));
  const baseConflicts = findTaskConflicts(await findAll<any>(Tasks()), uniqueParticipantIds, taskStart, taskEnd);
  
  const participants = uniqueParticipantIds.map((id: string) => ({
    userId: id,
    status: id === currentUser._id ? 'Accepted' : 'Pending'
  }));

  const recurrenceId = recurrenceRule !== 'none' && recurrenceCount > 1 ? `rec_${Date.now()}` : undefined;
  const createdTasks = Array.from({ length: recurrenceCount }, (_, index) => {
    const recurringStart = addRecurrenceDate(taskStart, recurrenceRule, index);
    const recurringEnd = addRecurrenceDate(taskEnd, recurrenceRule, index);
    return {
      _id: `t_${Date.now()}_${index}`,
      title,
      description,
      type: type || 'Meeting',
      status: 'Pending',
      startAt: recurringStart,
      endAt: recurringEnd,
      leadId,
      opportunityId,
      requestId,
      reminderAt: calculateReminderAt(recurringStart, reminderMinutesBefore),
      recurrenceId,
      recurrenceRule,
      creatorId: currentUser._id,
      participants,
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  await Promise.all(createdTasks.map(task => Tasks().insertOne(task as any)));
  await Promise.all(
    participants
      .filter((participant: any) => participant.userId !== currentUser._id)
      .map((participant: any) => createNotification(
        participant.userId,
        'คำเชิญนัดหมายใหม่',
        `${currentUser.name} เชิญคุณเข้าร่วม: ${title}`,
        'CalendarInvite',
        '/tasks'
      ))
  );
  res.status(201).json({ tasks: createdTasks, conflicts: baseConflicts });
});

app.put('/api/tasks/:id', requirePermission('manageTasks'), validateBody(updateTaskBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const tasksColl = Tasks();
  const task = await tasksColl.findOne({ _id: req.params.id } as any);
  if (!task || !userCanSeeTask(currentUser, task)) {
    res.status(404).json({ message: 'ไม่พบนัดหมายตารางงาน' });
    return;
  }
  if (task.creatorId !== currentUser._id && currentUser.rank < 4) {
    res.status(403).json({ message: 'แก้ไขได้เฉพาะผู้สร้างหรือ Manager ขึ้นไป' });
    return;
  }
  const start = req.body.startAt ? new Date(req.body.startAt) : asDate(task.startAt);
  const end = req.body.endAt ? new Date(req.body.endAt) : asDate(task.endAt);
  if (end <= start) {
    res.status(400).json({ message: 'วันและเวลาสิ้นสุดต้องมากกว่าวันและเวลาเริ่มต้น' });
    return;
  }
  const participantIds = req.body.participantIds ? Array.from(new Set([task.creatorId, ...req.body.participantIds])) : (task.participants || []).map((p: any) => p.userId);
  const participants = participantIds.map((id: string) => {
    const existing = (task.participants || []).find((p: any) => p.userId === id);
    return existing || { userId: id, status: id === task.creatorId ? 'Accepted' : 'Pending' };
  });
  const updatedTask = {
    ...task,
    ...req.body,
    startAt: start,
    endAt: end,
    participants,
    reminderAt: req.body.reminderMinutesBefore !== undefined ? calculateReminderAt(start, req.body.reminderMinutesBefore) : task.reminderAt,
    updatedAt: new Date()
  };
  delete (updatedTask as any).participantIds;
  delete (updatedTask as any).reminderMinutesBefore;
  await (tasksColl as any).updateOne({ _id: req.params.id }, { $set: updatedTask });
  await createAuditLog(req, currentUser, 'task.update', 'task', updatedTask, { before: task, after: updatedTask });
  res.json(updatedTask);
});

app.put('/api/tasks/:id/respond', requirePermission('manageTasks'), validateBody(taskRespondBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const tasksColl = Tasks();
  const task = await tasksColl.findOne({ _id: req.params.id } as any);
  if (!task) {
    res.status(404).json({ message: 'ไม่พบนัดหมายตารางงาน' });
    return;
  }

  const { status, reason } = req.body;

  // Verification: If declining higher rank creator, check if reason is provided
  if (status === 'Declined') {
    const creatorUser = await Users().findOne({ _id: task.creatorId } as any);
    if (creatorUser && currentUser.rank < creatorUser.rank) {
      if (!reason || reason.trim() === '') {
        res.status(400).json({ message: 'ต้องระบุเหตุผลในการปฏิเสธคำเชิญจากผู้บังคับบัญชา' });
        return;
      }
    }
  }

  // Update participant status
  const updatedParticipants = task.participants.map(p => {
    if (p.userId === currentUser._id) {
      return {
        ...p,
        status,
        reason,
        respondedAt: new Date()
      };
    }
    return p;
  });

  const updatedTask = {
    ...task,
    participants: updatedParticipants,
    updatedAt: new Date()
  };

  if ('updateOne' in tasksColl) {
    await (tasksColl as any).updateOne({ _id: req.params.id }, { $set: { participants: updatedParticipants, updatedAt: new Date() } });
  } else {
    const idx = (MemoryStore as any).tasks.findIndex((item: any) => item._id === req.params.id);
    if (idx !== -1) (MemoryStore as any).tasks[idx] = updatedTask;
  }

  if (task.creatorId !== currentUser._id) {
    await createNotification(
      task.creatorId,
      'อัปเดตคำเชิญนัดหมาย',
      `${currentUser.name} ตอบรับสถานะ ${status}: ${task.title}`,
      'TaskStatus',
      '/tasks'
    );
  }

  res.json(updatedTask);
});

app.put('/api/tasks/:id/complete', requirePermission('manageTasks'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const tasksColl = Tasks();
  const task = await tasksColl.findOne({ _id: req.params.id } as any);
  if (!task || !userCanSeeTask(currentUser, task)) {
    res.status(404).json({ message: 'ไม่พบนัดหมายตารางงาน' });
    return;
  }
  const updatedTask = { ...task, status: 'Completed', updatedAt: new Date() };
  await (tasksColl as any).updateOne({ _id: req.params.id }, { $set: updatedTask });
  await createAuditLog(req, currentUser, 'task.complete', 'task', updatedTask);
  res.json(updatedTask);
});

app.put('/api/tasks/:id/reopen', requirePermission('manageTasks'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const tasksColl = Tasks();
  const task = await tasksColl.findOne({ _id: req.params.id } as any);
  if (!task || !userCanSeeTask(currentUser, task)) {
    res.status(404).json({ message: 'ไม่พบนัดหมายตารางงาน' });
    return;
  }
  const updatedTask = { ...task, status: 'Pending', updatedAt: new Date() };
  await (tasksColl as any).updateOne({ _id: req.params.id }, { $set: updatedTask });
  await createAuditLog(req, currentUser, 'task.reopen', 'task', updatedTask);
  res.json(updatedTask);
});

app.post('/api/tasks/reminders/send-due', requirePermission('manageTasks'), requireRank(4), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const tasksColl = Tasks();
  const tasks = await findAll<any>(tasksColl);
  const now = new Date();
  const dueTasks = tasks.filter(task => task.reminderAt && !task.reminderSentAt && asDate(task.reminderAt) <= now && task.status !== 'Completed');
  await Promise.all(dueTasks.map(async task => {
    const recipients = Array.from(new Set([task.creatorId, ...(task.participants || []).map((participant: any) => participant.userId)]));
    await Promise.all(recipients.map(userId => createNotification(
      userId as string,
      'Reminder นัดหมายใกล้ถึงเวลา',
      `${task.title} เริ่ม ${asDate(task.startAt).toLocaleString('th-TH')}`,
      'CalendarInvite',
      '/calendar'
    )));
    await (tasksColl as any).updateOne({ _id: task._id }, { $set: { reminderSentAt: now, updatedAt: now } });
  }));
  await createAuditLog(req, currentUser, 'task.reminders.send_due', 'task', {}, { count: dueTasks.length });
  res.json({ sent: dueTasks.length });
});

app.post('/api/tasks/:id/comments', requirePermission('manageTasks'), validateBody(taskCommentBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { content } = req.body;
  if (!content || !String(content).trim()) {
    res.status(400).json({ message: 'ต้องระบุข้อความคอมเมนต์' });
    return;
  }

  const tasksColl = Tasks();
  const task = await tasksColl.findOne({ _id: req.params.id } as any);
  if (!task) {
    res.status(404).json({ message: 'ไม่พบนัดหมายตารางงาน' });
    return;
  }

  const isParticipant = task.creatorId === currentUser._id || task.participants?.some((p: any) => p.userId === currentUser._id);
  if (!isParticipant && currentUser.rank < 4) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์คอมเมนต์งานนี้' });
    return;
  }

  const comment = {
    authorId: currentUser._id,
    authorName: currentUser.name,
    content: String(content).trim(),
    createdAt: new Date()
  };
  const comments = [...(task.comments || []), comment];
  const updatedTask = { ...task, comments, updatedAt: new Date() };

  await (tasksColl as any).updateOne({ _id: req.params.id }, { $set: { comments, updatedAt: updatedTask.updatedAt } });
  res.status(201).json(updatedTask);
});

app.delete('/api/tasks/:id', requirePermission('manageTasks'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const tasksColl = Tasks();
  const task = await tasksColl.findOne({ _id: req.params.id } as any);
  if (!task) {
    res.status(404).json({ message: 'ไม่พบนัดหมายตารางงาน' });
    return;
  }
  if (task.creatorId !== currentUser._id && currentUser.rank < 4) {
    res.status(403).json({ message: 'ลบได้เฉพาะผู้สร้างหรือ Manager ขึ้นไป' });
    return;
  }

  await (tasksColl as any).deleteOne({ _id: req.params.id });
  await Promise.all((task.participants || [])
    .filter((participant: any) => participant.userId !== currentUser._id)
    .map((participant: any) => createNotification(
      participant.userId,
      'นัดหมายถูกยกเลิก',
      `${currentUser.name} ยกเลิกนัดหมาย: ${task.title}`,
      'TaskStatus',
      '/tasks'
    )));
  res.json({ message: 'Task deleted' });
});
// ------------------------------------------------------------------------------
// PRODUCTS & QUOTES (FINANCE)
// ------------------------------------------------------------------------------
// Removed duplicate static product route – will be handled by dedicated router

app.get('/api/quotes', requirePermission('manageQuotes'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const quotes = await findAll<any>(Quotations());
  if (currentUser.rank === 3) {
    const filtered = quotes.filter(q => q.creatorId === currentUser._id);
    res.json(filtered);
    return;
  }
  res.json(quotes);
});

app.get('/api/quotes/:id', requirePermission('manageQuotes'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const quote = await Quotations().findOne({ _id: req.params.id } as any);
  if (!currentUser || !quote) {
    res.status(quote ? 401 : 404).json({ message: quote ? 'Unauthorized' : 'ไม่พบใบเสนอราคา' });
    return;
  }
  if (!(await userCanAccessQuote(currentUser, quote))) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ดูใบเสนอราคานี้' });
    return;
  }

  const [lead, creator, approver, opportunity] = await Promise.all([
    quote.leadId ? Leads().findOne({ _id: quote.leadId } as any) : null,
    Users().findOne({ _id: quote.creatorId } as any),
    quote.approvedById ? Users().findOne({ _id: quote.approvedById } as any) : null,
    quote.convertedOpportunityId ? Opportunities().findOne({ _id: quote.convertedOpportunityId } as any) : null
  ]);
  res.json({ ...quote, lead, creator: sanitizeUser(creator), approver: sanitizeUser(approver), opportunity });
});

app.post('/api/quotes', requirePermission('manageQuotes'), validateBody(createQuoteBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { leadId, items, overallDiscountPercent, vatPercent, totalAmount, expiresAt, terms } = req.body;

  // Retrieve discount settings limit
  const discountSettings = await findAll<any>(DiscountLimits());
  const limits = discountSettings[0];
  
  const userLimit = getUserDiscountLimit(limits, currentUser);

  const discountPercentVal = Number(overallDiscountPercent) || 0;
  const isOverLimit = isDiscountOverLimit(discountPercentVal, userLimit);

  const newQuote = {
    _id: `qt_${Date.now()}`,
    quoteNumber: await nextDocumentNumber(Quotations(), 'QT'),
    version: 1,
    leadId,
    items: items || [],
    overallDiscountPercent: discountPercentVal,
    vatPercent: Number(vatPercent) || 7,
    totalAmount: Number(totalAmount) || 0,
    status: getQuoteStatusForDiscount(discountPercentVal, userLimit),
    creatorId: currentUser._id,
    requiredApprovalRank: isOverLimit ? await getRequiredQuoteApprovalRank(discountPercentVal, limits) : undefined,
    approvalTrail: [],
    revisions: [],
    emailStatus: 'Draft',
    expiresAt: expiresAt ? new Date(expiresAt) : addDays(30),
    terms: terms || 'ราคานี้มีผลภายในวันหมดอายุที่ระบุ และยังไม่รวมค่าใช้จ่ายนอกเหนือขอบเขตงานที่ตกลง',
    signatureStatus: 'Pending',
    discountLimitChecked: isOverLimit,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await Quotations().insertOne(newQuote as any);
  await createAuditLog(req, currentUser, 'quote.create', 'quote', newQuote, {
    quoteNumber: newQuote.quoteNumber,
    status: newQuote.status,
    requiredApprovalRank: newQuote.requiredApprovalRank,
    discountPercent: newQuote.overallDiscountPercent,
    totalAmount: newQuote.totalAmount
  });
  if (newQuote.status === 'PendingApproval') {
    await notifyManagers(
      'ใบเสนอราคารออนุมัติ',
      `${currentUser.name} ส่งใบเสนอราคา ${newQuote.quoteNumber} ที่เกินลิมิตส่วนลด`,
      'QuoteApproval',
      '/quotes',
      currentUser._id
    );
  }
  res.status(201).json(newQuote);
});

app.put('/api/quotes/:id/revise', requirePermission('manageQuotes'), validateBody(reviseQuoteBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const quoteColl = Quotations();
  const quote = await quoteColl.findOne({ _id: req.params.id } as any);
  if (!currentUser || !quote) {
    res.status(quote ? 401 : 404).json({ message: quote ? 'Unauthorized' : 'ไม่พบใบเสนอราคา' });
    return;
  }
  if (quote.creatorId !== currentUser._id && currentUser.rank < 4) {
    res.status(403).json({ message: 'แก้ไข revision ได้เฉพาะผู้สร้างหรือ Manager ขึ้นไป' });
    return;
  }

  const discountSettings = await findAll<any>(DiscountLimits());
  const userLimit = getUserDiscountLimit(discountSettings[0], currentUser);
  const nextDiscount = Number(req.body.overallDiscountPercent ?? quote.overallDiscountPercent ?? 0);
  const nextVersion = Number(quote.version || 1) + 1;
  const revision = {
    version: quote.version || 1,
    changedBy: currentUser._id,
    changedAt: new Date(),
    reason: req.body.reason,
    snapshot: {
      items: quote.items,
      overallDiscountPercent: quote.overallDiscountPercent,
      vatPercent: quote.vatPercent,
      totalAmount: quote.totalAmount,
      status: quote.status,
      expiresAt: quote.expiresAt,
      terms: quote.terms
    }
  };
  const updatedQuote = {
    ...quote,
    version: nextVersion,
    items: req.body.items ?? quote.items,
    overallDiscountPercent: nextDiscount,
    vatPercent: Number(req.body.vatPercent ?? quote.vatPercent ?? 7),
    totalAmount: Number(req.body.totalAmount ?? quote.totalAmount ?? 0),
    status: getQuoteStatusForDiscount(nextDiscount, userLimit),
    requiredApprovalRank: isDiscountOverLimit(nextDiscount, userLimit) ? await getRequiredQuoteApprovalRank(nextDiscount, discountSettings[0]) : undefined,
    discountLimitChecked: isDiscountOverLimit(nextDiscount, userLimit),
    expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : quote.expiresAt,
    terms: req.body.terms ?? quote.terms,
    rejectionReason: undefined,
    revisions: [...(quote.revisions || []), revision],
    updatedAt: new Date()
  };

  await (quoteColl as any).updateOne({ _id: req.params.id }, { $set: updatedQuote });
  await createAuditLog(req, currentUser, 'quote.revise', 'quote', updatedQuote, {
    quoteNumber: quote.quoteNumber,
    version: nextVersion,
    reason: req.body.reason
  });
  res.json(updatedQuote);
});

app.put('/api/quotes/:id/approve', requirePermission('manageQuotes'), requireRank(4), validateBody(decisionBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 4) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์อนุมัติใบเสนอราคา' });
    return;
  }

  const quoteColl = Quotations();
  const quote = await quoteColl.findOne({ _id: req.params.id } as any);
  if (!quote) {
    res.status(404).json({ message: 'ไม่พบใบเสนอราคา' });
    return;
  }

  const { status, reason } = req.body; // status: 'Approved' | 'Rejected'
  if (status === 'Approved' && quote.requiredApprovalRank && currentUser.rank < quote.requiredApprovalRank) {
    res.status(403).json({ message: `ใบเสนอราคานี้ต้องอนุมัติโดย Rank ${quote.requiredApprovalRank} ขึ้นไป` });
    return;
  }
  const updatedQuote = {
    ...quote,
    status,
    approvedById: currentUser._id,
    rejectionReason: reason,
    approvalTrail: [
      ...(quote.approvalTrail || []),
      {
        status,
        actorId: currentUser._id,
        actorName: currentUser.name,
        reason,
        decidedAt: new Date()
      }
    ],
    updatedAt: new Date()
  };

  if ('updateOne' in quoteColl) {
    await (quoteColl as any).updateOne({ _id: req.params.id }, { $set: updatedQuote });
  } else {
    const idx = (MemoryStore as any).quotations.findIndex((item: any) => item._id === req.params.id);
    if (idx !== -1) (MemoryStore as any).quotations[idx] = updatedQuote;
  }

  await createNotification(
    quote.creatorId,
    status === 'Approved' ? 'ใบเสนอราคาได้รับอนุมัติ' : 'ใบเสนอราคาถูกปฏิเสธ',
    `${quote.quoteNumber} ถูกอัปเดตเป็น ${status}${reason ? `: ${reason}` : ''}`,
    'QuoteStatus',
    '/quotes'
  );

  await createAuditLog(req, currentUser, status === 'Approved' ? 'quote.approve' : 'quote.reject', 'quote', updatedQuote, {
    before: { status: quote.status, approvedById: quote.approvedById, rejectionReason: quote.rejectionReason },
    after: { status: updatedQuote.status, approvedById: updatedQuote.approvedById, rejectionReason: updatedQuote.rejectionReason },
    reason
  });
  res.json(updatedQuote);
});

app.post('/api/quotes/:id/send', requirePermission('manageQuotes'), validateBody(sendQuoteBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const quoteColl = Quotations();
  const quote = await quoteColl.findOne({ _id: req.params.id } as any);
  if (!currentUser || !quote) {
    res.status(quote ? 401 : 404).json({ message: quote ? 'Unauthorized' : 'ไม่พบใบเสนอราคา' });
    return;
  }
  if (!(await userCanAccessQuote(currentUser, quote))) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ส่งใบเสนอราคานี้' });
    return;
  }

  const lead = quote.leadId ? await Leads().findOne({ _id: quote.leadId } as any) : null;
  const primaryEmail = Array.isArray(lead?.contacts) ? lead.contacts.find((contact: any) => contact.email)?.email : undefined;
  const sentToEmail = req.body.customerEmail || primaryEmail;
  if (!sentToEmail) {
    res.status(400).json({ message: 'ไม่พบอีเมลลูกค้า กรุณาระบุอีเมลก่อนส่ง' });
    return;
  }

  const updatedQuote = {
    ...quote,
    sentAt: new Date(),
    sentById: currentUser._id,
    sentToEmail,
    emailStatus: 'Sent',
    updatedAt: new Date()
  };
  await (quoteColl as any).updateOne({ _id: req.params.id }, { $set: updatedQuote });
  await createAuditLog(req, currentUser, 'quote.send', 'quote', updatedQuote, { sentToEmail });
  res.json(updatedQuote);
});

app.post('/api/quotes/:id/accept', requirePermission('manageQuotes'), validateBody(acceptQuoteBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const quoteColl = Quotations();
  const quote = await quoteColl.findOne({ _id: req.params.id } as any);
  if (!currentUser || !quote) {
    res.status(quote ? 401 : 404).json({ message: quote ? 'Unauthorized' : 'ไม่พบใบเสนอราคา' });
    return;
  }
  if (!(await userCanAccessQuote(currentUser, quote))) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์อัปเดตการยอมรับใบเสนอราคา' });
    return;
  }

  const updatedQuote = {
    ...quote,
    signatureStatus: 'Accepted',
    acceptedAt: new Date(),
    acceptedByName: req.body.customerName,
    updatedAt: new Date()
  };
  await (quoteColl as any).updateOne({ _id: req.params.id }, { $set: updatedQuote });
  await createAuditLog(req, currentUser, 'quote.accept', 'quote', updatedQuote, { acceptedByName: req.body.customerName });
  res.json(updatedQuote);
});

app.post('/api/quotes/:id/convert-to-opportunity', requirePermission('manageQuotes'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const quoteColl = Quotations();
  const quote = await quoteColl.findOne({ _id: req.params.id } as any);
  if (!currentUser || !quote) {
    res.status(quote ? 401 : 404).json({ message: quote ? 'Unauthorized' : 'ไม่พบใบเสนอราคา' });
    return;
  }
  if (!(await userCanAccessQuote(currentUser, quote))) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์แปลงใบเสนอราคานี้เป็นโอกาสขาย' });
    return;
  }
  if (!['Approved'].includes(quote.status) && quote.signatureStatus !== 'Accepted') {
    res.status(400).json({ message: 'แปลงได้เฉพาะใบเสนอราคาที่อนุมัติหรือได้รับการยอมรับแล้ว' });
    return;
  }
  if (quote.convertedOpportunityId) {
    const existing = await Opportunities().findOne({ _id: quote.convertedOpportunityId } as any);
    res.json(existing);
    return;
  }

  const lead = quote.leadId ? await Leads().findOne({ _id: quote.leadId } as any) : null;
  const opportunity = {
    _id: `opp_${Date.now()}`,
    leadId: quote.leadId,
    title: `Won: ${quote.quoteNumber}${lead?.schoolName ? ` - ${lead.schoolName}` : ''}`,
    stage: 'Won',
    value: Number(quote.totalAmount || 0),
    closeDate: new Date(),
    assignedTo: quote.creatorId,
    probability: 100,
    quoteIds: [quote._id],
    stageHistory: [{
      fromStage: 'Negotiation',
      toStage: 'Won',
      changedBy: currentUser._id,
      changedAt: new Date(),
      reason: `Converted from approved quote ${quote.quoteNumber}`
    }],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await Opportunities().insertOne(opportunity as any);
  const updatedQuote = { ...quote, convertedOpportunityId: opportunity._id, updatedAt: new Date() };
  await (quoteColl as any).updateOne({ _id: req.params.id }, { $set: updatedQuote });
  await createAuditLog(req, currentUser, 'quote.convert_to_opportunity', 'quote', updatedQuote, { opportunityId: opportunity._id });
  res.status(201).json(opportunity);
});

app.get('/api/discount-settings', requirePermission('manageDiscounts'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || (currentUser.rank < 4 && getSupportDepartment(currentUser) !== 'Finance')) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ดูการตั้งค่าส่วนลด' });
    return;
  }

  const settings = await findAll<any>(DiscountLimits());
  res.json(settings[0] || {
    _id: 'discount_default',
    roleLimits: [],
    individualLimits: [],
    history: []
  });
});

app.put('/api/discount-settings', requirePermission('manageDiscounts'), validateBody(discountSettingsBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || (currentUser.rank < 4 && getSupportDepartment(currentUser) !== 'Finance')) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขการตั้งค่าส่วนลด' });
    return;
  }

  const discountColl = DiscountLimits();
  const existing = (await findAll<any>(discountColl))[0];
  const roles = await findAll<any>(Roles());
  const users = await findAll<any>(Users());
  const roleRankById = new Map(roles.map((role: any) => [role._id, role.rank]));
  const userRankById = new Map(users.map((user: any) => [user._id, user.rank]));
  let nextRoleLimits = req.body.roleLimits || existing?.roleLimits || [];
  let nextIndividualLimits = req.body.individualLimits || existing?.individualLimits || [];

  if (currentUser.rank < 5) {
    const protectedRoleLimits = (existing?.roleLimits || []).filter((limit: any) => Number(roleRankById.get(limit.roleId) || 0) > 3);
    const editableRoleLimits = nextRoleLimits.filter((limit: any) => Number(roleRankById.get(limit.roleId) || 0) <= 3);
    nextRoleLimits = [
      ...protectedRoleLimits,
      ...editableRoleLimits.filter((limit: any) => !protectedRoleLimits.some((protectedLimit: any) => protectedLimit.roleId === limit.roleId))
    ];
    nextIndividualLimits = nextIndividualLimits.filter((limit: any) => Number(userRankById.get(limit.userId) || 0) === 3);
  }

  const updatedSettings = {
    _id: existing?._id || 'discount_default',
    roleLimits: nextRoleLimits,
    individualLimits: nextIndividualLimits,
    approvalMatrix: {
      managerMaxRank: 4,
      execRequiredAboveManagerLimit: true,
      updatedAt: new Date()
    },
    history: [
      ...(existing?.history || []),
      {
        changedBy: currentUser.name,
        details: 'อัปเดตเกณฑ์ส่วนลดจากหน้าตั้งค่า',
        changedAt: new Date()
      }
    ]
  };

  if (existing) {
    await (discountColl as any).updateOne({ _id: updatedSettings._id }, { $set: updatedSettings });
  } else {
    await discountColl.insertOne(updatedSettings as any);
  }

  await createAuditLog(req, currentUser, 'discount.update', 'discount_settings', updatedSettings, {
    before: existing || null,
    after: updatedSettings
  });
  res.json(updatedSettings);
});

// ------------------------------------------------------------------------------
// REQUESTS & AVAILABILITY
// ------------------------------------------------------------------------------
app.get('/api/requests', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const requests = await findAll<any>(Requests());

  // Filter based on roles
  if (currentUser.rank === 2) {
    // Support Staff: see only requests routed to their department
    const deptName = getSupportDepartment(currentUser);

    const filtered = requests.filter(r =>
      r.targetDepartment === deptName &&
      r.approvalFlow?.status !== 'Pending' &&
      r.status !== 'Rejected'
    );
    res.json(filtered);
    return;
  } else if (currentUser.rank === 3) {
    // Sales: see only requests created by them
    const filtered = requests.filter(r => r.creatorId === currentUser._id);
    res.json(filtered);
    return;
  }

  res.json(requests);
});

app.post('/api/requests', requireAuthenticated(), validateBody(createRequestBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { title, leadId, type, subTypes, targetDepartment, targetUserId, reason, priority, isDraft, attachments, startAt, endAt } = req.body;

  const isAutoApproved = currentUser.rank >= 4 && !isDraft; // Manager / Exec requests are auto-approved
  const normalizedStatus = isDraft ? 'Draft' : isAutoApproved ? 'Approved' : 'Submitted';
  const slaHours: Record<string, number> = { Low: 72, Medium: 48, High: 24, Urgent: 8 };
  
  // Get other managers/execs for acknowledgements
  const users = await findAll<any>(Users());
  const ackUsers = users.filter(u => u.rank >= 4 && u._id !== currentUser._id);
  const acknowledgements = isAutoApproved 
    ? ackUsers.map(u => ({ userId: u._id, acknowledged: false }))
    : [];

  const newRequest = {
    _id: `req_${Date.now()}`,
    requestNumber: await nextDocumentNumber(Requests(), 'REQ'),
    creatorId: currentUser._id,
    title,
    leadId,
    type: type || 'AdminSupport',
    subTypes: subTypes || [],
    targetDepartment: targetDepartment || 'AdminSupport',
    targetUserId,
    reason,
    priority: priority || 'Medium',
    slaDueAt: new Date(Date.parse(startAt) + (slaHours[priority || 'Medium'] || 48) * 60 * 60 * 1000),
    isDraft: Boolean(isDraft),
    attachments: (attachments || []).map((attachment: any) => ({
      ...attachment,
      uploadedBy: currentUser._id,
      uploadedAt: new Date()
    })),
    comments: [],
    statusHistory: [buildStatusHistoryEntry(currentUser, normalizedStatus)],
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    status: normalizedStatus,
    approvalFlow: {
      status: isAutoApproved ? 'Approved' : 'Pending',
      autoApproved: isAutoApproved
    },
    acknowledgements,
    assignment: {
      forwardHistory: []
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await Requests().insertOne(newRequest as any);
  await createAuditLog(req, currentUser, 'request.create', 'request', newRequest, {
    requestNumber: newRequest.requestNumber,
    status: newRequest.status,
    approvalStatus: newRequest.approvalFlow.status,
    targetDepartment: newRequest.targetDepartment,
    autoApproved: isAutoApproved
  });
  if (isDraft) {
    await createNotification(
      currentUser._id,
      'บันทึกคำขอแบบร่างแล้ว',
      `${newRequest.requestNumber}: ${title}`,
      'RequestStatus',
      '/requests'
    );
  } else if (isAutoApproved) {
    await Promise.all(ackUsers.map(user => createNotification(
      user._id,
      'คำขออนุมัติอัตโนมัติรอรับทราบ',
      `${currentUser.name} สร้างคำขอ ${newRequest.requestNumber}: ${title}`,
      'RequestStatus',
      '/requests'
    )));
    await notifySupportDepartment(
      newRequest.targetDepartment,
      'คำขอพร้อมรับงาน',
      `${newRequest.requestNumber}: ${title}`
    );
  } else {
    await notifyManagers(
      'คำขอใหม่รออนุมัติ',
      `${currentUser.name} ส่งคำขอ ${newRequest.requestNumber}: ${title}`,
      'RequestApproval',
      '/requests',
      currentUser._id
    );
  }
  res.status(201).json(newRequest);
});
app.use('/api/products', productsRouter);
app.use('/api/quotes', requirePermission('manageQuotes'), pdfRouter);
app.get('/api/requests/availability', requireAuthenticated(), async (req, res) => {
  const { date, department, targetUserId } = req.query; // YYYY-MM-DD
  if (!date || !department) {
    res.status(400).json({ message: 'ระบุวันที่และแผนกปลายทาง' });
    return;
  }

  const reqs = await findAll<any>(Requests());
  const searchDate = new Date(date as string).toISOString().split('T')[0];

  // Find all approved/claimed requests for that department on that day
  const searchStart = new Date(`${searchDate}T00:00:00`);
  const searchEnd = new Date(`${searchDate}T23:59:59.999`);
  const busyRequests = reqs.filter(r =>
    r.targetDepartment === department &&
    (!targetUserId || r.targetUserId === targetUserId || r.assignment?.assignedToId === targetUserId) &&
    (r.status === 'Approved' || r.status === 'Claimed') &&
    doTimeRangesOverlap({ startAt: r.startAt, endAt: r.endAt }, { startAt: searchStart, endAt: searchEnd })
  );
  const availability = evaluateAvailability(busyRequests);

  const busySlots = busyRequests.map(r => ({
    title: r.title,
    time: `${asDate(r.startAt).getHours().toString().padStart(2, '0')}:${asDate(r.startAt).getMinutes().toString().padStart(2, '0')} - ${asDate(r.endAt).getHours().toString().padStart(2, '0')}:${asDate(r.endAt).getMinutes().toString().padStart(2, '0')}`
  }));

  res.json({
    date,
    department,
    targetUserId,
    busySlots,
    status: availability.status,
    conflictCount: availability.conflictCount,
    suggestions: [
      new Date(Date.parse(date as string) + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date(Date.parse(date as string) + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date(Date.parse(date as string) + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    ]
  });
});

app.get('/api/requests/:id', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const request = await Requests().findOne({ _id: req.params.id } as any);
  if (!currentUser || !request) {
    res.status(request ? 401 : 404).json({ message: request ? 'Unauthorized' : 'ไม่พบคำขอ' });
    return;
  }
  if (!(await userCanAccessRequest(currentUser, request))) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ดูคำขอนี้' });
    return;
  }
  const [creator, assignee, lead] = await Promise.all([
    Users().findOne({ _id: request.creatorId } as any),
    request.assignment?.assignedToId ? Users().findOne({ _id: request.assignment.assignedToId } as any) : null,
    request.leadId ? Leads().findOne({ _id: request.leadId } as any) : null
  ]);
  res.json({ ...request, creator: sanitizeUser(creator), assignee: sanitizeUser(assignee), lead });
});

app.put('/api/requests/:id/approve', requirePermission('approveRequests'), requireRank(4), validateBody(decisionBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 4) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์อนุมัติคำขอ' });
    return;
  }

  const reqColl = Requests();
  const request = await reqColl.findOne({ _id: req.params.id } as any);
  if (!request) {
    res.status(404).json({ message: 'ไม่พบคำขอ' });
    return;
  }

  const { status, reason } = req.body; // status: 'Approved' | 'Rejected'
  
  const updatedReq = {
    ...request,
    status: status === 'Approved' ? 'Approved' : 'Rejected',
    approvalFlow: {
      status,
      approvedById: currentUser._id,
      decisionDate: new Date(),
      autoApproved: false
    },
    statusHistory: [
      ...(request.statusHistory || []),
      buildStatusHistoryEntry(currentUser, status === 'Approved' ? 'Approved' : 'Rejected', request.status, reason)
    ],
    updatedAt: new Date()
  };

  if ('updateOne' in reqColl) {
    await (reqColl as any).updateOne({ _id: req.params.id }, { $set: updatedReq });
  } else {
    const idx = (MemoryStore as any).requests.findIndex((item: any) => item._id === req.params.id);
    if (idx !== -1) (MemoryStore as any).requests[idx] = updatedReq;
  }

  await createNotification(
    request.creatorId,
    status === 'Approved' ? 'คำขอได้รับอนุมัติ' : 'คำขอถูกปฏิเสธ',
    `${request.requestNumber} ถูกอัปเดตเป็น ${updatedReq.status}${reason ? `: ${reason}` : ''}`,
    'RequestStatus',
    '/requests'
  );
  if (status === 'Approved') {
    await notifySupportDepartment(
      request.targetDepartment,
      'คำขอพร้อมรับงาน',
      `${request.requestNumber}: ${request.title}`
    );
  }

  await createAuditLog(req, currentUser, status === 'Approved' ? 'request.approve' : 'request.reject', 'request', updatedReq, {
    before: { status: request.status, approvalFlow: request.approvalFlow },
    after: { status: updatedReq.status, approvalFlow: updatedReq.approvalFlow },
    reason
  });
  res.json(updatedReq);
});

app.put('/api/requests/:id/claim', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const reqColl = Requests();
  const request = await reqColl.findOne({ _id: req.params.id } as any);
  if (!request) {
    res.status(404).json({ message: 'ไม่พบคำขอ' });
    return;
  }
  if (request.approvalFlow?.status === 'Pending' || request.status === 'Rejected') {
    res.status(400).json({ message: 'คำขอนี้ยังไม่พร้อมให้รับงาน' });
    return;
  }
  if (request.targetUserId && request.targetUserId !== currentUser._id && currentUser.rank < 4) {
    res.status(403).json({ message: 'คำขอนี้ระบุผู้รับงานเฉพาะบุคคล' });
    return;
  }

  const updatedReq = {
    ...request,
    status: 'Claimed' as const,
    assignment: {
      ...request.assignment,
      assignedToId: currentUser._id,
      claimedAt: new Date()
    },
    statusHistory: [
      ...(request.statusHistory || []),
      buildStatusHistoryEntry(currentUser, 'Claimed', request.status)
    ],
    updatedAt: new Date()
  };

  // Add task into claimer calendar
  const newTask = {
    _id: `t_claim_${Date.now()}`,
    title: `งานประสานงานคำขอ: ${request.title}`,
    description: `ประมวลผลคำขอรหัส ${request.requestNumber}`,
    type: 'Other' as const,
    status: 'Pending' as const,
    startAt: request.startAt,
    endAt: request.endAt,
    creatorId: request.creatorId,
    participants: [{ userId: currentUser._id, status: 'Accepted' }],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await Tasks().insertOne(newTask as any);

  if ('updateOne' in reqColl) {
    await (reqColl as any).updateOne({ _id: req.params.id }, { $set: updatedReq });
  } else {
    const idx = (MemoryStore as any).requests.findIndex((item: any) => item._id === req.params.id);
    if (idx !== -1) (MemoryStore as any).requests[idx] = updatedReq;
  }

  await createNotification(
    request.creatorId,
    'คำขอมีผู้รับงานแล้ว',
    `${currentUser.name} รับงานคำขอ ${request.requestNumber}`,
    'RequestStatus',
    '/requests'
  );

  await createAuditLog(req, currentUser, 'request.claim', 'request', updatedReq, {
    before: { status: request.status, assignment: request.assignment },
    after: { status: updatedReq.status, assignment: updatedReq.assignment },
    taskId: newTask._id
  });
  res.json(updatedReq);
});

app.put('/api/requests/:id/decline', requireAuthenticated(), validateBody(declineRequestBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { reason } = req.body;
  if (!reason || reason.trim() === '') {
    res.status(400).json({ message: 'ต้องระบุเหตุผลในการไม่สามารถปฏิบัติงานได้' });
    return;
  }

  const reqColl = Requests();
  const request = await reqColl.findOne({ _id: req.params.id } as any);
  if (!request) {
    res.status(404).json({ message: 'ไม่พบคำขอ' });
    return;
  }

  const updatedReq = {
    ...request,
    status: 'Rejected' as const,
    assignment: {
      ...request.assignment,
      rejectionReason: reason
    },
    statusHistory: [
      ...(request.statusHistory || []),
      buildStatusHistoryEntry(currentUser, 'Rejected', request.status, reason)
    ],
    updatedAt: new Date()
  };

  if ('updateOne' in reqColl) {
    await (reqColl as any).updateOne({ _id: req.params.id }, { $set: updatedReq });
  } else {
    const idx = (MemoryStore as any).requests.findIndex((item: any) => item._id === req.params.id);
    if (idx !== -1) (MemoryStore as any).requests[idx] = updatedReq;
  }

  await createNotification(
    request.creatorId,
    'คำขอถูกปฏิเสธโดยฝ่ายสนับสนุน',
    `${request.requestNumber}: ${reason}`,
    'RequestStatus',
    '/requests'
  );

  await createAuditLog(req, currentUser, 'request.decline', 'request', updatedReq, {
    before: { status: request.status, assignment: request.assignment },
    after: { status: updatedReq.status, assignment: updatedReq.assignment },
    reason
  });
  res.json(updatedReq);
});

app.put('/api/requests/:id/forward', requireAuthenticated(), validateBody(forwardRequestBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { targetDepartment, reason } = req.body;

  const reqColl = Requests();
  const request = await reqColl.findOne({ _id: req.params.id } as any);
  if (!request) {
    res.status(404).json({ message: 'ไม่พบคำขอ' });
    return;
  }

  const forwardLog = {
    fromDepartment: request.targetDepartment,
    toDepartment: targetDepartment,
    assignedToId: currentUser._id,
    reason,
    movedAt: new Date()
  };

  const updatedReq = {
    ...request,
    targetDepartment,
    status: 'Submitted' as const, // Put back to pending claim queue for new department
    assignment: {
      ...(request.assignment || {}),
      forwardHistory: [...(request.assignment?.forwardHistory || []), forwardLog]
    },
    statusHistory: [
      ...(request.statusHistory || []),
      buildStatusHistoryEntry(currentUser, 'Submitted', request.status, reason)
    ],
    updatedAt: new Date()
  };

  if ('updateOne' in reqColl) {
    await (reqColl as any).updateOne({ _id: req.params.id }, { $set: updatedReq });
  } else {
    const idx = (MemoryStore as any).requests.findIndex((item: any) => item._id === req.params.id);
    if (idx !== -1) (MemoryStore as any).requests[idx] = updatedReq;
  }

  await createNotification(
    request.creatorId,
    'คำขอถูกส่งต่อแผนก',
    `${request.requestNumber} ถูกส่งต่อไปยัง ${targetDepartment}${reason ? `: ${reason}` : ''}`,
    'RequestStatus',
    '/requests'
  );
  await notifySupportDepartment(
    targetDepartment,
    'มีคำขอถูกส่งต่อมา',
    `${request.requestNumber}: ${request.title}${reason ? ` (${reason})` : ''}`
  );

  await createAuditLog(req, currentUser, 'request.forward', 'request', updatedReq, {
    before: { status: request.status, targetDepartment: request.targetDepartment, assignment: request.assignment },
    after: { status: updatedReq.status, targetDepartment: updatedReq.targetDepartment, assignment: updatedReq.assignment },
    reason
  });
  res.json(updatedReq);
});

app.put('/api/requests/:id/ack', requirePermission('approveRequests'), requireRank(4), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 4) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ดำเนินการ' });
    return;
  }

  const reqColl = Requests();
  const request = await reqColl.findOne({ _id: req.params.id } as any);
  if (!request) {
    res.status(404).json({ message: 'ไม่พบคำขอ' });
    return;
  }

  const updatedAcks = request.acknowledgements.map(a => {
    if (a.userId === currentUser._id) {
      return {
        ...a,
        acknowledged: true,
        acknowledgedAt: new Date()
      };
    }
    return a;
  });

  const allAcksDone = updatedAcks.every(a => a.acknowledged);
  const updatedReq = {
    ...request,
    acknowledgements: updatedAcks,
    status: allAcksDone ? 'Acknowledged' as const : request.status,
    statusHistory: allAcksDone
      ? [
        ...(request.statusHistory || []),
        buildStatusHistoryEntry(currentUser, 'Acknowledged', request.status)
      ]
      : request.statusHistory || [],
    updatedAt: new Date()
  };

  if ('updateOne' in reqColl) {
    await (reqColl as any).updateOne({ _id: req.params.id }, { $set: updatedReq });
  } else {
    const idx = (MemoryStore as any).requests.findIndex((item: any) => item._id === req.params.id);
    if (idx !== -1) (MemoryStore as any).requests[idx] = updatedReq;
  }

  await createAuditLog(req, currentUser, 'request.acknowledge', 'request', updatedReq, {
    before: { status: request.status, acknowledgements: request.acknowledgements },
    after: { status: updatedReq.status, acknowledgements: updatedReq.acknowledgements }
  });
  res.json(updatedReq);
});

app.post('/api/requests/:id/comments', requireAuthenticated(), validateBody(requestCommentBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const reqColl = Requests();
  const request = await reqColl.findOne({ _id: req.params.id } as any);
  if (!currentUser || !request) {
    res.status(request ? 401 : 404).json({ message: request ? 'Unauthorized' : 'ไม่พบคำขอ' });
    return;
  }
  if (!(await userCanAccessRequest(currentUser, request))) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์เพิ่มความคิดเห็นในคำขอนี้' });
    return;
  }

  const comment = {
    authorId: currentUser._id,
    authorName: currentUser.name,
    content: req.body.content,
    createdAt: new Date()
  };
  const updatedReq = {
    ...request,
    comments: [...(request.comments || []), comment],
    updatedAt: new Date()
  };
  await (reqColl as any).updateOne({ _id: req.params.id }, { $set: updatedReq });
  await createNotification(
    request.creatorId,
    'มีความคิดเห็นใหม่ในคำขอ',
    `${request.requestNumber}: ${currentUser.name} แสดงความคิดเห็น`,
    'RequestStatus',
    '/requests'
  );
  await createAuditLog(req, currentUser, 'request.comment', 'request', updatedReq, { requestNumber: request.requestNumber });
  res.status(201).json(updatedReq);
});

app.put('/api/requests/:id/complete', requireAuthenticated(), validateBody(completeRequestBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const reqColl = Requests();
  const request = await reqColl.findOne({ _id: req.params.id } as any);
  if (!currentUser || !request) {
    res.status(request ? 401 : 404).json({ message: request ? 'Unauthorized' : 'ไม่พบคำขอ' });
    return;
  }
  const assignedToId = request.assignment?.assignedToId;
  if (assignedToId !== currentUser._id && currentUser.rank < 4) {
    res.status(403).json({ message: 'ปิดงานได้เฉพาะผู้รับงานหรือ Manager ขึ้นไป' });
    return;
  }
  if (request.status !== 'Claimed') {
    res.status(400).json({ message: 'ปิดงานได้เฉพาะคำขอที่มีผู้รับงานแล้ว' });
    return;
  }

  const completionComment = req.body.note ? {
    authorId: currentUser._id,
    authorName: currentUser.name,
    content: req.body.note,
    createdAt: new Date()
  } : null;
  const updatedReq = {
    ...request,
    status: 'Completed' as const,
    comments: completionComment ? [...(request.comments || []), completionComment] : request.comments || [],
    statusHistory: [
      ...(request.statusHistory || []),
      buildStatusHistoryEntry(currentUser, 'Completed', request.status, req.body.note)
    ],
    updatedAt: new Date()
  };

  await (reqColl as any).updateOne({ _id: req.params.id }, { $set: updatedReq });
  await createNotification(
    request.creatorId,
    'คำขอเสร็จสิ้นแล้ว',
    `${request.requestNumber} ดำเนินการเสร็จสิ้นโดย ${currentUser.name}`,
    'RequestStatus',
    '/requests'
  );
  await createAuditLog(req, currentUser, 'request.complete', 'request', updatedReq, {
    before: { status: request.status },
    after: { status: updatedReq.status },
    note: req.body.note
  });
  res.json(updatedReq);
});

// ------------------------------------------------------------------------------
// GLOBAL ADMIN CALENDAR
// ------------------------------------------------------------------------------
app.get('/api/admin-calendar/events', requireAuthenticated(), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (![2, 4, 5].includes(currentUser.rank)) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ดูปฏิทินกลางองค์กร' });
    return;
  }

  const [tasks, requests, users, leads] = await Promise.all([
    findAll<any>(Tasks()),
    findAll<any>(Requests()),
    findAll<any>(Users()),
    findAll<any>(Leads())
  ]);

  const userMap = new Map<string, any>(users.map((u: any) => [u._id, u]));
  const leadMap = new Map<string, any>(leads.map((l: any) => [l._id, l]));
  const supportDept = currentUser.rank === 2 ? getSupportDepartment(currentUser) : null;
  const canEdit = currentUser.rank >= 5;

  const getUserDepartment = (candidate: any) => {
    if (!candidate) return 'General';
    if (candidate.rank === 2) return getSupportDepartment(candidate);
    if (candidate.rank === 3) return candidate.zone ? `Sales / ${candidate.zone}` : 'Sales';
    if (candidate.rank >= 4) return 'Management';
    return 'General';
  };

  const getTaskDepartment = (task: any) => {
    if (task.adminEvent && task.adminDepartment) return task.adminDepartment;
    const creator = userMap.get(task.creatorId);
    const participants = (task.participants || [])
      .map((p: any) => userMap.get(p.userId))
      .filter(Boolean);
    const supportParticipant = participants.find((u: any) => u.rank === 2);
    if (supportParticipant) return getSupportDepartment(supportParticipant);
    return getUserDepartment(creator);
  };

  const isVisibleTask = (task: any) => {
    if (currentUser.rank >= 4) return true;
    if (!supportDept) return false;
    return getTaskDepartment(task) === supportDept;
  };

  const isVisibleRequest = (request: any) => {
    if (currentUser.rank >= 4) return true;
    return (
      request.targetDepartment === supportDept &&
      request.approvalFlow?.status !== 'Pending' &&
      request.status !== 'Rejected'
    );
  };

  const taskEvents = tasks.filter(isVisibleTask).map((task: any) => {
    const owner = userMap.get(task.creatorId);
    const lead = task.leadId ? leadMap.get(task.leadId) : null;
    const startAt = asDate(task.startAt || task.createdAt);
    const endAt = asDate(task.endAt || task.startAt || task.createdAt);

    return {
      id: task._id,
      source: task.adminEvent ? 'admin' : 'task',
      title: task.title,
      description: task.description || '',
      type: task.type,
      status: task.status,
      department: getTaskDepartment(task),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      ownerId: task.creatorId,
      ownerName: owner?.name || 'ไม่ระบุผู้รับผิดชอบ',
      leadId: task.leadId,
      leadName: lead?.schoolName,
      participants: (task.participants || []).map((p: any) => ({
        userId: p.userId,
        name: userMap.get(p.userId)?.name || 'ผู้ใช้อื่น',
        status: p.status
      })),
      history: task.calendarHistory || [],
      editable: canEdit
    };
  });

  const requestEvents = requests.filter(isVisibleRequest).map((request: any) => {
    const ownerId = request.assignment?.assignedToId || request.targetUserId || request.creatorId;
    const owner = userMap.get(ownerId);
    const creator = userMap.get(request.creatorId);
    const lead = request.leadId ? leadMap.get(request.leadId) : null;
    const startAt = asDate(request.startAt || request.createdAt);
    const endAt = asDate(request.endAt || request.startAt || request.createdAt);

    return {
      id: request._id,
      source: 'request',
      title: request.title,
      description: request.reason || '',
      type: request.type,
      status: request.status,
      approvalStatus: request.approvalFlow?.status,
      requestNumber: request.requestNumber,
      department: request.targetDepartment,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      ownerId,
      ownerName: owner?.name || 'รอรับงาน',
      creatorId: request.creatorId,
      creatorName: creator?.name || 'ไม่ระบุผู้สร้าง',
      leadId: request.leadId,
      leadName: lead?.schoolName,
      history: request.calendarHistory || request.statusHistory || [],
      editable: canEdit
    };
  });

  const events = [...taskEvents, ...requestEvents].sort(
    (a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  res.json({
    events,
    permissions: {
      canEdit,
      scope: currentUser.rank >= 4 ? 'all' : 'department',
      supportDepartment: supportDept
    },
    generatedAt: new Date()
  });
});

app.post('/api/admin-calendar/events', requirePermission('editAdminCalendar'), requireRank(5), validateBody(adminCalendarCreateBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 5) {
    res.status(403).json({ message: 'เฉพาะ Executive เท่านั้นที่สร้างปฏิทินกลางได้' });
    return;
  }

  const startAt = new Date(req.body.startAt);
  const endAt = new Date(req.body.endAt);
  if (await hasScheduleConflict(startAt, endAt)) {
    res.status(409).json({ message: 'ช่วงเวลานี้ชนกับ task/request ที่มีอยู่ในปฏิทินกลาง' });
    return;
  }

  const ownerId = req.body.ownerId || currentUser._id;
  const newTask = {
    _id: `adm_${Date.now()}`,
    title: req.body.title,
    description: req.body.description || '',
    type: 'Other',
    status: 'Pending',
    startAt,
    endAt,
    creatorId: ownerId,
    adminEvent: true,
    adminDepartment: req.body.department,
    participants: ownerId === currentUser._id ? [] : [{ userId: ownerId, status: 'Pending' }],
    calendarHistory: [buildStatusHistoryEntry(currentUser, 'Created')],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await Tasks().insertOne(newTask as any);
  await createAuditLog(req, currentUser, 'admin_calendar.create_event', 'task', newTask, {
    department: req.body.department,
    ownerId
  });
  res.status(201).json(newTask);
});

app.put('/api/admin-calendar/events/:source/:id', requirePermission('editAdminCalendar'), requireRank(5), validateBody(adminCalendarUpdateBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  if (currentUser.rank < 5) {
    res.status(403).json({ message: 'เฉพาะ Executive เท่านั้นที่แก้ไขปฏิทินกลางได้' });
    return;
  }

  const source = String(req.params.source);
  const id = String(req.params.id);
  const { title, startAt, endAt, status, targetDepartment } = req.body;
  const updateData: any = { updatedAt: new Date() };

  if (title !== undefined) updateData.title = title;
  if (startAt) updateData.startAt = new Date(startAt);
  if (endAt) updateData.endAt = new Date(endAt);

  if (startAt || endAt) {
    const proposedStart = startAt ? new Date(startAt) : undefined;
    const proposedEnd = endAt ? new Date(endAt) : undefined;
    if (proposedStart && proposedEnd && await hasScheduleConflict(proposedStart, proposedEnd, { source: source === 'admin' ? 'task' : source, id })) {
      res.status(409).json({ message: 'ช่วงเวลานี้ชนกับแผนงานอื่นในปฏิทินกลาง' });
      return;
    }
  }

  if (source === 'task' || source === 'admin') {
    const allowedStatuses = ['Pending', 'Completed', 'Overdue'];
    if (status && !allowedStatuses.includes(status)) {
      res.status(400).json({ message: 'สถานะงานไม่ถูกต้อง' });
      return;
    }
    if (status) updateData.status = status;

    const tasksColl = Tasks();
    const task = await tasksColl.findOne({ _id: id } as any);
    if (!task) {
      res.status(404).json({ message: 'ไม่พบงานในปฏิทิน' });
      return;
    }

    const updatedTask = {
      ...task,
      ...updateData,
      calendarHistory: [
        ...((task as any).calendarHistory || []),
        buildStatusHistoryEntry(currentUser, String(updateData.status || task.status || 'Updated'), task.status, 'Admin calendar update')
      ]
    };
    await (tasksColl as any).updateOne({ _id: id }, { $set: updatedTask });
    await createAuditLog(req, currentUser, 'admin_calendar.update_task', 'task', updatedTask, {
      before: task,
      after: updatedTask,
      changedFields: Object.keys(updateData).filter(field => field !== 'updatedAt')
    });
    res.json(updatedTask);
    return;
  }

  if (source === 'request') {
    const allowedStatuses = ['Submitted', 'Approved', 'Rejected', 'Acknowledged', 'Claimed', 'Completed'];
    const allowedDepartments = ['AdminSupport', 'Finance', 'Academic', 'Production'];
    if (status && !allowedStatuses.includes(status)) {
      res.status(400).json({ message: 'สถานะคำขอไม่ถูกต้อง' });
      return;
    }
    if (targetDepartment && !allowedDepartments.includes(targetDepartment)) {
      res.status(400).json({ message: 'แผนกปลายทางไม่ถูกต้อง' });
      return;
    }
    if (status) updateData.status = status;
    if (targetDepartment) updateData.targetDepartment = targetDepartment;

    const reqColl = Requests();
    const request = await reqColl.findOne({ _id: id } as any);
    if (!request) {
      res.status(404).json({ message: 'ไม่พบคำขอในปฏิทิน' });
      return;
    }

    const updatedRequest = {
      ...request,
      ...updateData,
      calendarHistory: [
        ...((request as any).calendarHistory || []),
        buildStatusHistoryEntry(currentUser, String(updateData.status || request.status || 'Updated'), request.status, 'Admin calendar update')
      ]
    };
    await (reqColl as any).updateOne({ _id: id }, { $set: updatedRequest });
    await createAuditLog(req, currentUser, 'admin_calendar.update_request', 'request', updatedRequest, {
      before: request,
      after: updatedRequest,
      changedFields: Object.keys(updateData).filter(field => field !== 'updatedAt')
    });
    res.json(updatedRequest);
    return;
  }

  res.status(400).json({ message: 'ประเภท event ไม่ถูกต้อง' });
});

// ------------------------------------------------------------------------------
// AI LOGGER
// ------------------------------------------------------------------------------
app.get('/api/ai/logs', requirePermission('useAIChat'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (!(await canUseAIChat(currentUser))) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ใช้งาน AI Logger' });
    return;
  }

  const logs = await findAll<any>(AILogs());
  const visibleLogs = logs
    .filter(log => currentUser.rank >= 4 || log.userId === currentUser._id)
    .sort((a, b) => asDate(b.createdAt).getTime() - asDate(a.createdAt).getTime())
    .slice(0, 20);

  res.json(visibleLogs);
});

app.post('/api/ai/parse-log', requirePermission('useAIChat'), validateBody(aiParseBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (!(await canUseAIChat(currentUser))) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ใช้งาน AI Logger' });
    return;
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    res.status(400).json({ message: 'กรุณากรอกข้อความสนทนา' });
    return;
  }
  if (text.length > 3000) {
    res.status(400).json({ message: 'ข้อความยาวเกินไป กรุณาย่อให้ไม่เกิน 3,000 ตัวอักษร' });
    return;
  }

  const startedAt = Date.now();
  const parsed = await parseConversationalLog(text);
  const latencyMs = Date.now() - startedAt;
  const matchedLead = await findVisibleLeadMatch(currentUser, parsed, text);
  const enriched = enrichParsedLogWithLead(parsed, matchedLead);
  const reviewReasons = [
    (enriched.confidence || 0) < 0.6 ? 'confidence_below_60' : '',
    ...(enriched.missingFields || []).map(field => `missing_${field}`)
  ].filter(Boolean);
  const aiLog = {
    _id: `ailog_${Date.now()}`,
    userId: currentUser._id,
    rawText: text,
    parsed: enriched,
    leadId: matchedLead?._id,
    status: 'Parsed',
    promptVersion: 'ai-logger-v2.1',
    provider: (enriched.confidence || 0) <= 0.68 ? 'fallback' : 'gemini',
    usage: {
      inputChars: text.length,
      estimatedTokens: Math.ceil(text.length / 4),
      latencyMs,
      estimatedCostUsd: Number((Math.ceil(text.length / 4) * 0.00000035).toFixed(6))
    },
    guardrails: {
      requiresReview: reviewReasons.length > 0,
      reviewReasons
    },
    createdAt: new Date()
  };
  await AILogs().insertOne(aiLog as any);
  await createAuditLog(req, currentUser, 'ai.parse_log', 'ai_log', aiLog, {
    leadId: matchedLead?._id,
    status: aiLog.status,
    textLength: text.length,
    usage: aiLog.usage,
    guardrails: aiLog.guardrails
  });

  res.json({
    ...enriched,
    aiLogId: aiLog._id,
    leadId: matchedLead?._id,
    matchedLead: matchedLead ? {
      _id: matchedLead._id,
      schoolName: matchedLead.schoolName,
      zone: matchedLead.zone,
      status: matchedLead.status,
      primaryContact: Array.isArray(matchedLead.contacts) ? matchedLead.contacts[0] : null
    } : null,
    promptVersion: aiLog.promptVersion,
    provider: aiLog.provider,
    usage: aiLog.usage,
    guardrails: aiLog.guardrails
  });
});

app.post('/api/ai/confirm-log', requirePermission('useAIChat'), validateBody(aiConfirmBodySchema), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (!(await canUseAIChat(currentUser))) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์ใช้งาน AI Logger' });
    return;
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const dateStr = typeof req.body?.dateStr === 'string' ? req.body.dateStr : '';
  const timeStr = typeof req.body?.timeStr === 'string' ? req.body.timeStr : '';
  const type: ConversationalTaskType = AI_TASK_TYPES.includes(req.body?.type) ? req.body.type : 'Other';
  const urgency: UrgencyLevel = AI_URGENCY_LEVELS.includes(req.body?.urgency) ? req.body.urgency : 'Medium';
  const parsedPayload = buildAILogParsedPayload(req.body, type, urgency);
  const confidence = Number(req.body?.confidence ?? parsedPayload.confidence ?? 0);
  const missingFields = Array.isArray(req.body?.missingFields) ? req.body.missingFields : parsedPayload.missingFields || [];
  const reviewReasons = [
    confidence < 0.6 ? 'confidence_below_60' : '',
    ...missingFields.map((field: string) => `missing_${field}`)
  ].filter(Boolean);
  if (reviewReasons.length > 0 && !req.body?.confirmLowConfidence) {
    res.status(400).json({
      message: 'AI ยังไม่มั่นใจข้อมูลบางช่อง กรุณาติ๊กยืนยันว่าตรวจสอบแล้วก่อนบันทึก',
      reviewReasons
    });
    return;
  }

  if (!title) {
    res.status(400).json({ message: 'กรุณาระบุหัวข้องาน' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) {
    res.status(400).json({ message: 'รูปแบบวันที่หรือเวลาไม่ถูกต้อง' });
    return;
  }

  const startAt = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(startAt.getTime())) {
    res.status(400).json({ message: 'ไม่สามารถแปลงวันเวลาเป็นตารางงานได้' });
    return;
  }
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

  let matchedLead = null;
  if (req.body?.leadId) {
    const lead = await Leads().findOne({ _id: req.body.leadId } as any);
    if (lead) matchedLead = lead;
  }
  if (!matchedLead) {
    matchedLead = await findVisibleLeadMatch(currentUser, req.body, req.body?.rawText || '');
  }

  const participantIds = Array.isArray(req.body?.participantIds)
    ? req.body.participantIds.filter((id: any) => typeof id === 'string')
    : [];
  const uniqueParticipantIds = Array.from(new Set([currentUser._id, ...participantIds]));
  const participants = uniqueParticipantIds.map((id: string) => ({
    userId: id,
    status: id === currentUser._id ? 'Accepted' : 'Pending'
  }));

  const task = {
    _id: `t_ai_${Date.now()}`,
    title,
    description: buildAILogDescription({ ...req.body, urgency }, matchedLead),
    type,
    status: 'Pending',
    startAt,
    endAt,
    leadId: matchedLead?._id,
    creatorId: currentUser._id,
    participants,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await Tasks().insertOne(task as any);

  const aiLogId = typeof req.body?.aiLogId === 'string' ? req.body.aiLogId : '';
  const aiLogsColl = AILogs();
  if (aiLogId) {
    const existingLog = await aiLogsColl.findOne({ _id: aiLogId } as any);
    if (existingLog && (existingLog.userId === currentUser._id || currentUser.rank >= 4)) {
      await (aiLogsColl as any).updateOne(
        { _id: aiLogId },
        {
          $set: {
            ...existingLog,
            parsed: parsedPayload,
            leadId: matchedLead?._id,
            taskId: task._id,
            status: 'Confirmed',
            guardrails: {
              ...(existingLog.guardrails || {}),
              requiresReview: false,
              reviewReasons,
              confirmedBy: currentUser._id
            },
            confirmedAt: new Date()
          }
        }
      );
    }
  } else {
    await aiLogsColl.insertOne({
      _id: `ailog_${Date.now()}`,
      userId: currentUser._id,
      rawText: typeof req.body?.rawText === 'string' ? req.body.rawText : '',
      parsed: parsedPayload,
      leadId: matchedLead?._id,
      taskId: task._id,
      status: 'Confirmed',
      promptVersion: 'ai-logger-v2.1',
      provider: 'manual',
      usage: {
        inputChars: String(req.body?.rawText || '').length,
        estimatedTokens: Math.ceil(String(req.body?.rawText || '').length / 4),
        estimatedCostUsd: 0
      },
      guardrails: {
        requiresReview: false,
        reviewReasons,
        confirmedBy: currentUser._id
      },
      createdAt: new Date(),
      confirmedAt: new Date()
    } as any);
  }

  await appendAINoteToLead(matchedLead, currentUser, { ...req.body, title, urgency }, task._id);
  await createAuditLog(req, currentUser, 'ai.confirm_log', 'task', task, {
    aiLogId: typeof req.body?.aiLogId === 'string' ? req.body.aiLogId : undefined,
    leadId: matchedLead?._id,
    type,
    urgency
  });

  res.status(201).json({
    task,
    matchedLead: matchedLead ? {
      _id: matchedLead._id,
      schoolName: matchedLead.schoolName,
      zone: matchedLead.zone,
      status: matchedLead.status
    } : null
  });
});

app.post('/api/ai/logs/:id/export-summary', requirePermission('useAIChat'), async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const aiLog = await AILogs().findOne({ _id: req.params.id } as any);
  if (!aiLog || (aiLog.userId !== currentUser._id && currentUser.rank < 4)) {
    res.status(404).json({ message: 'ไม่พบ AI log' });
    return;
  }
  const summary = [
    `[AI Summary] ${aiLog.parsed?.title || 'สรุปกิจกรรม'}`,
    aiLog.parsed?.schoolMentioned ? `โรงเรียน: ${aiLog.parsed.schoolMentioned}` : '',
    aiLog.parsed?.contactName ? `ผู้ติดต่อ: ${aiLog.parsed.contactName}` : '',
    aiLog.parsed?.notes ? `สรุป: ${aiLog.parsed.notes}` : '',
    `Confidence: ${Math.round(Number(aiLog.parsed?.confidence || 0) * 100)}%`,
    aiLog.guardrails?.reviewReasons?.length ? `Review: ${aiLog.guardrails.reviewReasons.join(', ')}` : ''
  ].filter(Boolean).join('\n');

  if (aiLog.leadId) {
    const lead = await Leads().findOne({ _id: aiLog.leadId } as any);
    if (lead) {
      const notes = Array.isArray(lead.notes) ? lead.notes : [];
      await (Leads() as any).updateOne({ _id: lead._id }, {
        $set: {
          notes: [
            ...notes,
            {
              id: `note_ai_summary_${Date.now()}`,
              content: summary,
              type: 'ai_summary',
              createdBy: currentUser._id,
              createdAt: new Date()
            }
          ],
          updatedAt: new Date()
        }
      });
    }
  }
  res.json({ summary, exportedToLead: Boolean(aiLog.leadId) });
});

// Global Error Handler
app.use(errorHandler);

export default app;
