import { Db } from 'mongodb';
import * as Types from '../types/index.js';

export async function seedDatabase(db: Db) {
  console.log('[seed]: Checking database collections for bootstrap...');

  // 1. Roles
  const rolesCollection = db.collection('roles');
  const rolesCount = await rolesCollection.countDocuments();
  if (rolesCount === 0) {
    console.log('[seed]: Seeding roles...');
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
    await rolesCollection.insertMany(initialRoles as any);
  }

  // 2. Users
  const usersCollection = db.collection('users');
  const usersCount = await usersCollection.countDocuments();
  if (usersCount === 0) {
    console.log('[seed]: Seeding users...');
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
      { _id: 'u14', name: 'พิมพ์นิภา ทองใส', email: 'prod2@nextgen.co.th', passwordHash: '1234', roleId: 'r_support', rank: 2, createdAt: new Date(), updatedAt: new Date() }
    ];
    await usersCollection.insertMany(initialUsers as any);
  }

  // 3. Products
  const productsCollection = db.collection('products');
  const productsCount = await productsCollection.countDocuments();
  if (productsCount === 0) {
    console.log('[seed]: Seeding products...');
    const initialProducts: Types.Product[] = [
      { _id: 'p1', name: 'หลักสูตรวิทยาการคำนวณระดับประถม (Coding A)', price: 45000, category: 'Coding', isActive: true, specialOffers: 'ซื้อ 10 แถม 1 ชุดคู่มือครู' },
      { _id: 'p2', name: 'หลักสูตรวิทยาการคำนวณระดับมัธยม (Coding B)', price: 65000, category: 'Coding', isActive: true },
      { _id: 'p3', name: 'ชุดสื่อบอร์ดหุ่นยนต์อัจฉริยะ (Robotics Kit v3)', price: 12500, category: 'Hardware', isActive: true, specialOffers: 'รับประกัน 2 ปีเต็ม' },
      { _id: 'p4', name: 'ระบบการเรียนรู้ดิจิทัล LMS (1 ปี)', price: 95000, category: 'Software', isActive: true, specialOffers: 'ฟรีอบรมเทรนนิ่งบุคลากร 2 ครั้ง' }
    ];
    await productsCollection.insertMany(initialProducts as any);
  }

  // 4. Discount Limits
  const discountCollection = db.collection('discount_settings');
  const discountCount = await discountCollection.countDocuments();
  if (discountCount === 0) {
    console.log('[seed]: Seeding discount limits...');
    const initialDiscount: Types.DiscountLimit = {
      roleLimits: [
        { roleId: 'r_sales', maxDiscountPercent: 10 },
        { roleId: 'r_manager', maxDiscountPercent: 20 },
        { roleId: 'r_exec', maxDiscountPercent: 40 }
      ],
      individualLimits: [
        { userId: 'u4', maxDiscountPercent: 15 } // ธนกร ได้ลิมิตพิเศษ 15%
      ],
      history: [
        { changedBy: 'ดร.วิชัย สุริยา', details: 'ตั้งค่าลิมิตเริ่มต้นระบบ', changedAt: new Date() }
      ]
    };
    await discountCollection.insertOne(initialDiscount as any);
  }

  // 5. Leads & Schools
  const leadsCollection = db.collection('leads');
  const leadsCount = await leadsCollection.countDocuments();
  if (leadsCount === 0) {
    console.log('[seed]: Seeding leads/schools...');
    const initialLeads: Types.Lead[] = [
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
        assignedTo: 'u5', // นภัสสร
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
        assignedTo: 'u4', // ธนกร
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
        assignedTo: 'u6', // กฤษฎา
        notes: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    await leadsCollection.insertMany(initialLeads as any);
  }

  // 6. Opportunities
  const oppCollection = db.collection('opportunities');
  const oppCount = await oppCollection.countDocuments();
  if (oppCount === 0) {
    console.log('[seed]: Seeding opportunities...');
    const initialOpp: Types.Opportunity[] = [
      {
        _id: 'o1',
        leadId: 'l1',
        title: 'โครงการติดตั้งห้องเรียนคอมพิวเตอร์อัจฉริยะ อนุบาลชลบุรี',
        stage: 'Proposal',
        value: 450000,
        closeDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // in 15 days
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
        closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // in 30 days
        assignedTo: 'u4',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    await oppCollection.insertMany(initialOpp as any);
  }

  console.log('[seed]: Database bootstrap verification complete.');
}
