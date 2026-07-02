import { Collection } from 'mongodb';
import { db, getDbStatus } from '../config/mongodb.js';
import * as Types from '../types/index.js';

// Simple In-Memory mock store fallback
const memoryDb: Record<string, any[]> = {
  users: [],
  roles: [],
  leads: [],
  opportunities: [],
  tasks: [],
  quotations: [],
  requests: [],
  products: [],
  discount_settings: [],
  notifications: [],
  ai_logs: [],
  audit_logs: []
};

// Seed initial roles and users in memory in case MongoDB is not running
const initialRoles: Types.Role[] = [
  {
    _id: 'r_exec',
    name: 'Executive',
    rank: 5,
    color: '#EF4444',
    permissions: {
      viewDashboard: true, manageLeads: true, managePipeline: true, manageTasks: true,
      useAIChat: true, viewTeamOverview: true, manageProducts: true, manageDiscounts: true,
      manageUsersAndRoles: true, editAdminCalendar: true, manageQuotes: true, approveRequests: true
    },
    isSystemRole: true
  },
  {
    _id: 'r_asst',
    name: 'Executive Assistant',
    rank: 4,
    color: '#F59E0B',
    permissions: {
      viewDashboard: true, manageLeads: true, managePipeline: true, manageTasks: true,
      useAIChat: true, viewTeamOverview: true, manageProducts: true, manageDiscounts: true,
      manageUsersAndRoles: true, editAdminCalendar: true, manageQuotes: true, approveRequests: true
    },
    isSystemRole: true
  },
  {
    _id: 'r_manager',
    name: 'Sales Manager',
    rank: 4,
    color: '#10B981',
    permissions: {
      viewDashboard: true, manageLeads: true, managePipeline: true, manageTasks: true,
      useAIChat: true, viewTeamOverview: true, manageProducts: true, manageDiscounts: true,
      manageUsersAndRoles: false, editAdminCalendar: false, manageQuotes: true, approveRequests: true
    },
    isSystemRole: true
  },
  {
    _id: 'r_sales',
    name: 'Sales',
    rank: 3,
    color: '#3B82F6',
    permissions: {
      viewDashboard: true, manageLeads: true, managePipeline: true, manageTasks: true,
      useAIChat: true, viewTeamOverview: false, manageProducts: false, manageDiscounts: false,
      manageUsersAndRoles: false, editAdminCalendar: false, manageQuotes: true, approveRequests: false
    },
    isSystemRole: true
  },
  {
    _id: 'r_support',
    name: 'Admin Support',
    rank: 2,
    color: '#6366F1',
    permissions: {
      viewDashboard: true, manageLeads: true, managePipeline: true, manageTasks: true,
      useAIChat: false, viewTeamOverview: false, manageProducts: false, manageDiscounts: false,
      manageUsersAndRoles: false, editAdminCalendar: false, manageQuotes: false, approveRequests: false
    },
    isSystemRole: true
  }
];

const initialUsers: Types.User[] = [
  { _id: 'u1', name: 'ดร.วิชัย สุริยา', email: 'exec@nextgen.co.th', passwordHash: '1234', roleId: 'r_exec', rank: 5, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u2', name: 'พิชาภรณ์ วงศ์ศรี', email: 'assist@nextgen.co.th', passwordHash: '1234', roleId: 'r_asst', rank: 4, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u3', name: 'จิราพร มั่นคง', email: 'manager@nextgen.co.th', passwordHash: '1234', roleId: 'r_manager', rank: 4, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u4', name: 'ธนกร รุ่งเรือง', email: 'sales1@nextgen.co.th', passwordHash: '1234', roleId: 'r_sales', rank: 3, zone: 'ภาคเหนือ', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u5', name: 'นภัสสร ใจดี', email: 'sales2@nextgen.co.th', passwordHash: '1234', roleId: 'r_sales', rank: 3, zone: 'ภาคตะวันออก', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u6', name: 'กฤษฎา สุขใส', email: 'sales3@nextgen.co.th', passwordHash: '1234', roleId: 'r_sales', rank: 3, zone: 'ภาคใต้', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u7', name: 'อรอุมา พรมดี', email: 'sales4@nextgen.co.th', passwordHash: '1234', roleId: 'r_sales', rank: 3, zone: 'ภาคตะวันตก', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u8', name: 'ปิยะ ศรีทอง', email: 'sales5@nextgen.co.th', passwordHash: '1234', roleId: 'r_sales', rank: 3, zone: 'ภาคอีสาน', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u15', name: 'ศุภกิจ ใจกลาง', email: 'sales6@nextgen.co.th', passwordHash: '1234', roleId: 'r_sales', rank: 3, zone: 'ภาคกลาง', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u9', name: 'วรากร ดีงาม', email: 'central@nextgen.co.th', passwordHash: '1234', roleId: 'r_support', rank: 2, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u10', name: 'สุภาพร คลังทรัพย์', email: 'finance@nextgen.co.th', passwordHash: '1234', roleId: 'r_support', rank: 2, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u11', name: 'ดร.ชนม์ชนก วิชัย', email: 'academic1@nextgen.co.th', passwordHash: '1234', roleId: 'r_support', rank: 2, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u12', name: 'สรรเสริญ มานะ', email: 'academic2@nextgen.co.th', passwordHash: '1234', roleId: 'r_support', rank: 2, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u13', name: 'ณัฐพล เครือสาร', email: 'prod1@nextgen.co.th', passwordHash: '1234', roleId: 'r_support', rank: 2, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'u14', name: 'พิมพ์นิภา ทองใส', email: 'prod2@nextgen.co.th', passwordHash: '1234', roleId: 'r_support', rank: 2, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'root', name: 'ผู้ดูแลระบบ (Root Admin)', email: 'root@nextgen.co.th', passwordHash: 'S3cureRootPass!2026', roleId: 'r_exec', rank: 5, createdAt: new Date(), updatedAt: new Date() }
];

memoryDb.roles = initialRoles;
memoryDb.users = initialUsers;
memoryDb.products = [
  { _id: 'p1', name: 'หลักสูตรวิทยาการคำนวณระดับประถม (Coding A)', price: 45000, category: 'Coding', isActive: true, specialOffers: 'ซื้อ 10 แถม 1 ชุดคู่มือครู' },
  { _id: 'p2', name: 'หลักสูตรวิทยาการคำนวณระดับมัธยม (Coding B)', price: 65000, category: 'Coding', isActive: true },
  { _id: 'p3', name: 'ชุดสื่อบอร์ดหุ่นยนต์อัจฉริยะ (Robotics Kit v3)', price: 12500, category: 'Hardware', isActive: true, specialOffers: 'รับประกัน 2 ปีเต็ม' },
  { _id: 'p4', name: 'ระบบการเรียนรู้ดิจิทัล LMS (1 ปี)', price: 95000, category: 'Software', isActive: true, specialOffers: 'ฟรีอบรมเทรนนิ่งบุคลากร 2 ครั้ง' }
];
memoryDb.discount_settings = [
  {
    _id: 'discount_default',
    roleLimits: [
      { roleId: 'r_sales', maxDiscountPercent: 10 },
      { roleId: 'r_manager', maxDiscountPercent: 20 },
      { roleId: 'r_exec', maxDiscountPercent: 40 }
    ],
    individualLimits: [
      { userId: 'u4', maxDiscountPercent: 15 }
    ],
    history: [
      { changedBy: 'System', details: 'ตั้งค่าลิมิตเริ่มต้นระบบจำลอง', changedAt: new Date() }
    ]
  }
];
memoryDb.leads = [
  {
    _id: 'l1',
    schoolName: 'โรงเรียนอนุบาลชลบุรี',
    address: 'อ.เมือง จ.ชลบุรี',
    zone: 'ภาคตะวันออก',
    status: 'Hot',
    stage: 'Demo Scheduled',
    score: 85,
    gradeLevels: 'ประถม-มัธยมต้น',
    province: 'ชลบุรี',
    studentCount: 1200,
    upperElementaryStudentCount: 360,
    contacts: [
      { name: 'ครูแอน', position: 'หัวหน้ากลุ่มสาระคอมพิวเตอร์', phone: '081-234-5678', email: 'ann@chonburi.ac.th' }
    ],
    assignedTo: 'u5',
    notes: [
      { author: 'นภัสสร ใจดี', content: 'ผอ. สนใจโครงการวิทยาการคำนวณมาก นัดจัดสาธิตวันศุกร์นี้', createdAt: new Date() }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'l2',
    schoolName: 'โรงเรียนเชียงใหม่คริสเตียน',
    address: 'อ.เมือง จ.เชียงใหม่',
    zone: 'ภาคเหนือ',
    status: 'Warm',
    stage: 'Proposal Sent',
    score: 60,
    gradeLevels: 'ประถม-มัธยมปลาย',
    province: 'เชียงใหม่',
    studentCount: 900,
    upperElementaryStudentCount: 280,
    contacts: [
      { name: 'ครูสุเทพ', position: 'หัวหน้างาน ICT', phone: '089-876-5432' }
    ],
    assignedTo: 'u4',
    notes: [
      { author: 'ธนกร รุ่งเรือง', content: 'โทรไปแนะนำหลักสูตรเบื้องต้นแล้ว ส่งอีเมลเสนอราคาเบื้องต้นไปแล้ว', createdAt: new Date() }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'l3',
    schoolName: 'โรงเรียนสุราษฎร์พิทยา',
    address: 'อ.เมือง จ.สุราษฎร์ธานี',
    zone: 'ภาคใต้',
    status: 'Cold',
    stage: 'New Lead',
    score: 30,
    gradeLevels: 'ประถมศึกษา',
    province: 'สุราษฎร์ธานี',
    studentCount: 650,
    upperElementaryStudentCount: 210,
    contacts: [
      { name: 'ครูสมเจตน์', position: 'งานสารสนเทศ', phone: '077-111-222' }
    ],
    assignedTo: 'u6',
    notes: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];
memoryDb.opportunities = [
  {
    _id: 'o1',
    leadId: 'l1',
    title: 'โครงการติดตั้งห้องเรียนคอมพิวเตอร์อัจฉริยะ อนุบาลชลบุรี',
    stage: 'Proposal',
    value: 450000,
    closeDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    assignedTo: 'u5',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'o2',
    leadId: 'l2',
    title: 'จัดซื้อสื่อ Coding ระดับประถม เชียงใหม่คริสเตียน',
    stage: 'Demo',
    value: 125000,
    closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    assignedTo: 'u4',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Simple simulation of Mongo DB find/insert in memory for easy prototype testing
function assertMemoryWriteAllowed(collectionName: string, operation: string) {
  const status = getDbStatus();
  if (status.memoryWriteBlocked) {
    const error: any = new Error(
      `Database write blocked: ${operation} on ${collectionName} cannot run while MongoDB is unavailable and ALLOW_MEMORY_DB is not true.`
    );
    error.statusCode = 503;
    error.code = 'MEMORY_DB_WRITE_BLOCKED';
    throw error;
  }
}

export class MemoryCollection<T extends { _id?: string }> {
  constructor(private name: string) {}

  async find(query: any = {}): Promise<T[]> {
    let list = memoryDb[this.name] || [];
    const entries = Object.entries(query);
    if (entries.length > 0) {
      list = list.filter(item =>
        entries.every(([key, value]) => {
          if (value && typeof value === 'object') return true;
          return (item as any)[key] === value;
        })
      );
    }
    return list as T[];
  }

  async findOne(query: any): Promise<T | null> {
    const list = await this.find(query);
    return list[0] || null;
  }

  async insertOne(item: T): Promise<{ insertedId: string }> {
    assertMemoryWriteAllowed(this.name, 'insertOne');
    const id = item._id || Math.random().toString(36).substring(7);
    const doc = { ...item, _id: id };
    memoryDb[this.name]?.push(doc);
    return { insertedId: id };
  }

  async updateOne(query: any, update: any): Promise<{ matchedCount: number; modifiedCount: number }> {
    assertMemoryWriteAllowed(this.name, 'updateOne');
    const list = memoryDb[this.name] || [];
    const idx = list.findIndex(item => Object.entries(query).every(([key, value]) => (item as any)[key] === value));
    if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };
    const setData = update?.$set || update || {};
    list[idx] = { ...list[idx], ...setData };
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(query: any): Promise<{ deletedCount: number }> {
    assertMemoryWriteAllowed(this.name, 'deleteOne');
    const list = memoryDb[this.name] || [];
    const idx = list.findIndex(item => Object.entries(query).every(([key, value]) => (item as any)[key] === value));
    if (idx === -1) return { deletedCount: 0 };
    list.splice(idx, 1);
    return { deletedCount: 1 };
  }
}

export function getCollection<T extends { _id?: string }>(name: string): Collection<T> | MemoryCollection<T> {
  const status = getDbStatus();
  if (status.isMocked || !db) {
    return new MemoryCollection<T>(name) as any;
  }
  return db.collection<T>(name);
}

// Collection bindings
export const Users = () => getCollection<Types.User>('users');
export const Roles = () => getCollection<Types.Role>('roles');
export const Leads = () => getCollection<Types.Lead>('leads');
export const Opportunities = () => getCollection<Types.Opportunity>('opportunities');
export const Tasks = () => getCollection<Types.Task>('tasks');
export const Quotations = () => getCollection<Types.Quotation>('quotations');
export const Requests = () => getCollection<Types.Request>('requests');
export const Products = () => getCollection<Types.Product>('products');
export const Notifications = () => getCollection<Types.Notification>('notifications');
export const DiscountLimits = () => getCollection<Types.DiscountLimit>('discount_settings');
export const AILogs = () => getCollection<Types.AILog>('ai_logs');
export const AuditLogs = () => getCollection<Types.AuditLog>('audit_logs');
export const MemoryStore = memoryDb;
