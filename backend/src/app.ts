import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { getDbStatus } from './config/mongodb.js';
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
  MemoryStore
} from './models/db.js';
import { getAICoachSuggestions, parseConversationalLog } from './services/ai.service.js';
import type { ConversationalTaskType, ParsedConversationalLog, UrgencyLevel } from './services/ai.service.js';
import { getQuoteStatusForDiscount, getUserDiscountLimit, isDiscountOverLimit } from './utils/discount.js';
import { doTimeRangesOverlap, evaluateAvailability } from './utils/schedule.js';
import productsRouter from './routes/products.js';
import pdfRouter from './routes/pdf.js';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_EXPIRES_IN = '7d';
const app = express();

app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3001',
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

function getSupportDepartment(user: any): 'AdminSupport' | 'Finance' | 'Academic' | 'Production' {
  if (user?.email?.includes('finance')) return 'Finance';
  if (user?.email?.includes('academic')) return 'Academic';
  if (user?.email?.includes('prod')) return 'Production';
  return 'AdminSupport';
}

function asDate(value: any): Date {
  return value instanceof Date ? value : new Date(value);
}

async function canUseAIChat(user: any): Promise<boolean> {
  if (!user) return false;
  const role = await Roles().findOne({ _id: user.roleId } as any);
  return Boolean(role?.permissions?.useAIChat);
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
  await Notifications().insertOne({
    _id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    title,
    message,
    type,
    targetUrl,
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
  res.json({
    status: 'online',
    database: getDbStatus(),
    timestamp: new Date()
  });
});

// ------------------------------------------------------------------------------
// AUTHENTICATION
// ------------------------------------------------------------------------------
  // Existing mock login (keep for dev convenience)
  app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Users().findOne({ email } as any);
    console.log('Login attempt:', { email, password });
    console.log('Found user:', user);
    console.log('Stored hash:', user?.passwordHash);
    if (!user || user.passwordHash !== password) {
      res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: SESSION_EXPIRES_IN });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE_MS });
    res.json({ token, user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      rank: user.rank,
      zone: user.zone,
      roleId: user.roleId
    } });
  } catch (err) {
    console.error('[login] Unexpected error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

  // New JWT login endpoint (alias for existing login, kept for clarity)
  // You may use this endpoint instead of the mock login above.
  // It follows the same logic, so the implementation is already covered.
  // No additional code needed here.

  // User swap endpoint
  app.post('/api/auth/swap', async (req, res) => {
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
    // Permission check: current rank must be >= target rank
    if (currentUser.rank < targetUser.rank) {
      res.status(403).json({ message: 'Insufficient rank to swap to this user' });
      return;
    }
    // Issue new JWT for target user
    const newToken = jwt.sign({ userId: targetUser._id }, JWT_SECRET, { expiresIn: SESSION_EXPIRES_IN });
    // Set cookie
    res.cookie('token', newToken, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE_MS });
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
app.get('/api/users', async (req, res) => {
  const users = await findAll<any>(Users());
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 4) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงข้อมูล' });
    return;
  }

  const { name, email, password, roleId, rank, zone } = req.body;

  // Strict Permission rule: Only Exec (rank 5) can assign Executive Assistant (r_asst)
  if (roleId === 'r_asst' && currentUser.rank < 5) {
    res.status(403).json({ message: 'เฉพาะผู้บริหารระดับสูงเท่านั้นที่สามารถมอบหมายสิทธิ์ผู้ช่วยผู้บริหารได้' });
    return;
  }

  const newUser = {
    _id: `u_${Date.now()}`,
    name,
    email,
    passwordHash: password || '1234',
    roleId,
    rank: Number(rank),
    zone,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await Users().insertOne(newUser);
  res.status(201).json(newUser);
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 5) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้' });
    return;
  }
  const { id } = req.params;
  const updateData = {
    ...req.body,
    permissions: normalizePermissions(req.body?.permissions)
  };
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
  const updatedUser = { ...existingUser, ...updateData, updatedAt: new Date() };
  if ('updateOne' in userColl) {
    await (userColl as any).updateOne({ _id: id }, { $set: updatedUser });
  } else {
    const idx = (MemoryStore as any).users.findIndex((u: any) => u._id === id);
    if (idx !== -1) (MemoryStore as any).users[idx] = updatedUser;
  }
  res.json(updatedUser);
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
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
  if ('deleteOne' in userColl) {
    await (userColl as any).deleteOne({ _id: id });
  } else {
    const idx = (MemoryStore as any).users.findIndex((u: any) => u._id === id);
    if (idx !== -1) (MemoryStore as any).users.splice(idx, 1);
  }
  res.json({ message: 'User deleted' });
});


// Update role
app.put('/api/roles/:id', async (req, res) => {
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
  res.json(updatedRole);
});

// Delete role
app.delete('/api/roles/:id', async (req, res) => {
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
  if ('deleteOne' in roleColl) {
    await (roleColl as any).deleteOne({ _id: id });
  } else {
    const idx = (MemoryStore as any).roles.findIndex((r: any) => r._id === id);
    if (idx !== -1) (MemoryStore as any).roles.splice(idx, 1);
  }
  res.json({ message: 'Role deleted' });
});

app.get('/api/roles', async (req, res) => {
  const roles = await findAll<any>(Roles());
  res.json(roles);
});
app.post('/api/roles', async (req, res) => {
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
  res.status(201).json(newRole);
});

// ------------------------------------------------------------------------------
// NOTIFICATIONS
// ------------------------------------------------------------------------------
app.get('/api/notifications', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const notifications = await findAll<any>(Notifications(), { userId: currentUser._id });
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(notifications);
});

app.put('/api/notifications/read-all', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const notifications = await findAll<any>(Notifications(), { userId: currentUser._id });
  await Promise.all(notifications.map(notification =>
    (Notifications() as any).updateOne({ _id: notification._id }, { $set: { isRead: true } })
  ));
  res.json({ updated: notifications.length });
});

app.put('/api/notifications/:id/read', async (req, res) => {
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

// ------------------------------------------------------------------------------
// LEADS & SCHOOLS
// ------------------------------------------------------------------------------
app.get('/api/leads', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // Retrieve leads – works with both mock MemoryCollection (returns array) and MongoDB Collection (returns cursor)
  const leadsArray = await findAll<any>(Leads());

  // Filter leads based on Sales zone if current user is Sales (rank 3)
  if (currentUser.rank === 3) {
    const userZone = currentUser.zone || '';
    const filteredLeads = leadsArray.filter(l => l.assignedTo === currentUser._id || l.zone === userZone);
    res.json(filteredLeads);
    return;
  }

  res.json(leadsArray);
});

app.get('/api/leads/:id', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const lead = await Leads().findOne({ _id: req.params.id } as any);
  if (!lead) {
    res.status(404).json({ message: 'ไม่พบข้อมูลโรงเรียน' });
    return;
  }
  res.json(lead);
});

app.post('/api/leads', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { schoolName, address, zone, status, score, contacts } = req.body;
  const newLead = {
    _id: `l_${Date.now()}`,
    schoolName,
    address,
    zone,
    status: status || 'Cold',
    score: Number(score) || 10,
    contacts: contacts || [],
    assignedTo: currentUser._id,
    notes: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await Leads().insertOne(newLead as any);
  res.status(201).json(newLead);
});

app.put('/api/leads/:id', async (req, res) => {
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

  const { status, score, notes, contacts } = req.body;
  const updatedLead = {
    ...lead,
    status: status || lead.status,
    score: score !== undefined ? Number(score) : lead.score,
    contacts: contacts || lead.contacts,
    notes: notes ? [...lead.notes, ...notes] : lead.notes,
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

  res.json(updatedLead);
});

app.post('/api/leads/:id/ai-coach', async (req, res) => {
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
app.get('/api/opportunities', async (req, res) => {
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

app.post('/api/opportunities', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { leadId, title, value, closeDate, stage } = req.body;
  const newOpp = {
    _id: `o_${Date.now()}`,
    leadId,
    title,
    stage: stage || 'Qualified',
    value: Number(value) || 0,
    closeDate: new Date(closeDate),
    assignedTo: currentUser._id,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await Opportunities().insertOne(newOpp as any);
  res.status(201).json(newOpp);
});

app.put('/api/opportunities/:id/stage', async (req, res) => {
  const oppsColl = Opportunities();
  const opp = await oppsColl.findOne({ _id: req.params.id } as any);
  if (!opp) {
    res.status(404).json({ message: 'ไม่พบโอกาสการขาย' });
    return;
  }

  const { stage } = req.body;
  const updatedOpp = {
    ...opp,
    stage,
    updatedAt: new Date()
  };

  if ('updateOne' in oppsColl) {
    await (oppsColl as any).updateOne({ _id: req.params.id }, { $set: { stage, updatedAt: new Date() } });
  } else {
    const idx = (MemoryStore as any).opportunities.findIndex((item: any) => item._id === req.params.id);
    if (idx !== -1) (MemoryStore as any).opportunities[idx] = updatedOpp;
  }

  res.json(updatedOpp);
});

// ------------------------------------------------------------------------------
// TASKS & APPOINTMENTS
// ------------------------------------------------------------------------------
app.get('/api/tasks', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const tasks = await findAll<any>(Tasks());
  
  // Show tasks created by the user or where the user is a participant
  const filtered = tasks.filter(t => 
    t.creatorId === currentUser._id || 
    t.participants.some((p: any) => p.userId === currentUser._id)
  );

  res.json(filtered);
});

app.post('/api/tasks', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { title, description, type, startAt, endAt, leadId, participantIds } = req.body;
  const taskStart = new Date(startAt);
  const taskEnd = new Date(endAt);
  if (Number.isNaN(taskStart.getTime()) || Number.isNaN(taskEnd.getTime()) || taskEnd <= taskStart) {
    res.status(400).json({ message: 'วันและเวลาสิ้นสุดต้องมากกว่าวันและเวลาเริ่มต้น' });
    return;
  }
  
  const participants = (participantIds || []).map((id: string) => ({
    userId: id,
    status: id === currentUser._id ? 'Accepted' : 'Pending'
  }));

  const newTask = {
    _id: `t_${Date.now()}`,
    title,
    description,
    type: type || 'Meeting',
    status: 'Pending',
    startAt: taskStart,
    endAt: taskEnd,
    leadId,
    creatorId: currentUser._id,
    participants,
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await Tasks().insertOne(newTask as any);
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
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id/respond', async (req, res) => {
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

app.post('/api/tasks/:id/comments', async (req, res) => {
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

app.delete('/api/tasks/:id', async (req, res) => {
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

app.get('/api/quotes', async (req, res) => {
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

app.post('/api/quotes', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { leadId, items, overallDiscountPercent, vatPercent, totalAmount } = req.body;

  // Retrieve discount settings limit
  const discountSettings = await findAll<any>(DiscountLimits());
  const limits = discountSettings[0];
  
  const userLimit = getUserDiscountLimit(limits, currentUser);

  const discountPercentVal = Number(overallDiscountPercent) || 0;
  const isOverLimit = isDiscountOverLimit(discountPercentVal, userLimit);

  const newQuote = {
    _id: `qt_${Date.now()}`,
    quoteNumber: `QT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    leadId,
    items: items || [],
    overallDiscountPercent: discountPercentVal,
    vatPercent: Number(vatPercent) || 7,
    totalAmount: Number(totalAmount) || 0,
    status: getQuoteStatusForDiscount(discountPercentVal, userLimit),
    creatorId: currentUser._id,
    discountLimitChecked: isOverLimit,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await Quotations().insertOne(newQuote as any);
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

app.put('/api/quotes/:id/approve', async (req, res) => {
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
  const updatedQuote = {
    ...quote,
    status,
    approvedById: currentUser._id,
    rejectionReason: reason,
    updatedAt: new Date()
  };

  if ('updateOne' in quoteColl) {
    await (quoteColl as any).updateOne({ _id: req.params.id }, { $set: { status, approvedById: currentUser._id, rejectionReason: reason, updatedAt: new Date() } });
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

  res.json(updatedQuote);
});

app.get('/api/discount-settings', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 4) {
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

app.put('/api/discount-settings', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.rank < 4) {
    res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขการตั้งค่าส่วนลด' });
    return;
  }

  const discountColl = DiscountLimits();
  const existing = (await findAll<any>(discountColl))[0];
  const updatedSettings = {
    _id: existing?._id || 'discount_default',
    roleLimits: req.body.roleLimits || existing?.roleLimits || [],
    individualLimits: req.body.individualLimits || existing?.individualLimits || [],
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

  res.json(updatedSettings);
});

// ------------------------------------------------------------------------------
// REQUESTS & AVAILABILITY
// ------------------------------------------------------------------------------
app.get('/api/requests', async (req, res) => {
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

app.post('/api/requests', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { title, leadId, type, subTypes, targetDepartment, targetUserId, reason, startAt, endAt } = req.body;

  const isAutoApproved = currentUser.rank >= 4; // Manager / Exec requests are auto-approved
  
  // Get other managers/execs for acknowledgements
  const users = await findAll<any>(Users());
  const ackUsers = users.filter(u => u.rank >= 4 && u._id !== currentUser._id);
  const acknowledgements = isAutoApproved 
    ? ackUsers.map(u => ({ userId: u._id, acknowledged: false }))
    : [];

  const newRequest = {
    _id: `req_${Date.now()}`,
    requestNumber: `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    creatorId: currentUser._id,
    title,
    leadId,
    type: type || 'AdminSupport',
    subTypes: subTypes || [],
    targetDepartment: targetDepartment || 'AdminSupport',
    targetUserId,
    reason,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    status: isAutoApproved ? 'Approved' : 'Submitted',
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
  if (isAutoApproved) {
    await Promise.all(ackUsers.map(user => createNotification(
      user._id,
      'คำขออนุมัติอัตโนมัติรอรับทราบ',
      `${currentUser.name} สร้างคำขอ ${newRequest.requestNumber}: ${title}`,
      'RequestStatus',
      '/requests'
    )));
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
app.use('/api/quotes', pdfRouter);
app.get('/api/requests/availability', async (req, res) => {
  const { date, department } = req.query; // YYYY-MM-DD
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

app.put('/api/requests/:id/approve', async (req, res) => {
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
    updatedAt: new Date()
  };

  if ('updateOne' in reqColl) {
    await (reqColl as any).updateOne({ _id: req.params.id }, { $set: { status: updatedReq.status, approvalFlow: updatedReq.approvalFlow, updatedAt: new Date() } });
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

  res.json(updatedReq);
});

app.put('/api/requests/:id/claim', async (req, res) => {
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

  const updatedReq = {
    ...request,
    status: 'Claimed' as const,
    assignment: {
      ...request.assignment,
      assignedToId: currentUser._id,
      claimedAt: new Date()
    },
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
    await (reqColl as any).updateOne({ _id: req.params.id }, { $set: { status: 'Claimed', assignment: updatedReq.assignment, updatedAt: new Date() } });
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

  res.json(updatedReq);
});

app.put('/api/requests/:id/decline', async (req, res) => {
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
    updatedAt: new Date()
  };

  if ('updateOne' in reqColl) {
    await (reqColl as any).updateOne({ _id: req.params.id }, { $set: { status: 'Rejected', assignment: updatedReq.assignment, updatedAt: new Date() } });
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

  res.json(updatedReq);
});

app.put('/api/requests/:id/forward', async (req, res) => {
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
      forwardHistory: [...(request.assignment.forwardHistory || []), forwardLog]
    },
    updatedAt: new Date()
  };

  if ('updateOne' in reqColl) {
    await (reqColl as any).updateOne({ _id: req.params.id }, { $set: { targetDepartment, status: 'Submitted', assignment: updatedReq.assignment, updatedAt: new Date() } });
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

  res.json(updatedReq);
});

app.put('/api/requests/:id/ack', async (req, res) => {
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
    updatedAt: new Date()
  };

  if ('updateOne' in reqColl) {
    await (reqColl as any).updateOne({ _id: req.params.id }, { $set: { acknowledgements: updatedAcks, status: updatedReq.status, updatedAt: new Date() } });
  } else {
    const idx = (MemoryStore as any).requests.findIndex((item: any) => item._id === req.params.id);
    if (idx !== -1) (MemoryStore as any).requests[idx] = updatedReq;
  }

  res.json(updatedReq);
});

// ------------------------------------------------------------------------------
// GLOBAL ADMIN CALENDAR
// ------------------------------------------------------------------------------
app.get('/api/admin-calendar/events', async (req, res) => {
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
      source: 'task',
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

app.put('/api/admin-calendar/events/:source/:id', async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  if (currentUser.rank < 5) {
    res.status(403).json({ message: 'เฉพาะ Executive เท่านั้นที่แก้ไขปฏิทินกลางได้' });
    return;
  }

  const { source, id } = req.params;
  const { title, startAt, endAt, status, targetDepartment } = req.body;
  const updateData: any = { updatedAt: new Date() };

  if (title !== undefined) updateData.title = title;
  if (startAt) updateData.startAt = new Date(startAt);
  if (endAt) updateData.endAt = new Date(endAt);

  if (source === 'task') {
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

    await (tasksColl as any).updateOne({ _id: id }, { $set: updateData });
    res.json({ ...task, ...updateData });
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

    await (reqColl as any).updateOne({ _id: id }, { $set: updateData });
    res.json({ ...request, ...updateData });
    return;
  }

  res.status(400).json({ message: 'ประเภท event ไม่ถูกต้อง' });
});

// ------------------------------------------------------------------------------
// AI LOGGER
// ------------------------------------------------------------------------------
app.get('/api/ai/logs', async (req, res) => {
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

app.post('/api/ai/parse-log', async (req, res) => {
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

  const parsed = await parseConversationalLog(text);
  const matchedLead = await findVisibleLeadMatch(currentUser, parsed, text);
  const enriched = enrichParsedLogWithLead(parsed, matchedLead);
  const aiLog = {
    _id: `ailog_${Date.now()}`,
    userId: currentUser._id,
    rawText: text,
    parsed: enriched,
    leadId: matchedLead?._id,
    status: 'Parsed',
    createdAt: new Date()
  };
  await AILogs().insertOne(aiLog as any);

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
    } : null
  });
});

app.post('/api/ai/confirm-log', async (req, res) => {
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
      createdAt: new Date(),
      confirmedAt: new Date()
    } as any);
  }

  await appendAINoteToLead(matchedLead, currentUser, { ...req.body, title, urgency }, task._id);

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

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[error]:', err);
  res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
});

export default app;
