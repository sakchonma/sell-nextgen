export interface User {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
  rank: number;
  zone?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  _id: string;
  name: string;
  rank: number;
  color: string;
  permissions: {
    viewDashboard: boolean;
    manageLeads: boolean;
    managePipeline: boolean;
    manageTasks: boolean;
    useAIChat: boolean;
    viewTeamOverview: boolean;
    manageProducts: boolean;
    manageDiscounts: boolean;
    manageUsersAndRoles: boolean;
    editAdminCalendar: boolean;
    manageQuotes: boolean;
    approveRequests: boolean;
  };
  isSystemRole: boolean;
}

export interface Lead {
  _id: string;
  schoolName: string;
  address: string;
  zone: string;
  status: 'Cold' | 'Warm' | 'Hot' | 'Customer';
  score: number;
  contacts: Array<{
    name: string;
    position: string;
    phone: string;
    email?: string;
  }>;
  assignedTo: string;
  notes: Array<{
    author: string;
    content: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Opportunity {
  _id: string;
  leadId: string;
  title: string;
  stage: 'Qualified' | 'Proposal' | 'Demo' | 'Negotiation' | 'Won' | 'Lost';
  value: number;
  closeDate: Date;
  assignedTo: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  type: 'Call' | 'Meeting' | 'Demo' | 'FollowUp' | 'Other';
  status: 'Pending' | 'Completed' | 'Overdue';
  startAt: Date;
  endAt: Date;
  leadId?: string;
  creatorId: string;
  participants: Array<{
    userId: string;
    status: 'Pending' | 'Accepted' | 'Acknowledged' | 'Declined';
    reason?: string;
    respondedAt?: Date;
  }>;
  comments?: Array<{
    authorId: string;
    authorName: string;
    content: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Quotation {
  _id: string;
  quoteNumber: string;
  leadId: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    discountPercent: number;
  }>;
  overallDiscountPercent: number;
  vatPercent: number;
  totalAmount: number;
  status: 'Draft' | 'PendingApproval' | 'Approved' | 'Rejected';
  creatorId: string;
  approvedById?: string;
  rejectionReason?: string;
  discountLimitChecked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Request {
  _id: string;
  requestNumber: string;
  creatorId: string;
  title: string;
  leadId?: string;
  type: 'AdminSupport' | 'Expense' | 'MarketingMaterial';
  subTypes: string[];
  targetDepartment: 'AdminSupport' | 'Finance' | 'Academic' | 'Production';
  targetUserId?: string;
  reason: string;
  startAt: Date;
  endAt: Date;
  status: 'Submitted' | 'Approved' | 'Rejected' | 'Acknowledged' | 'Claimed' | 'Completed';
  approvalFlow: {
    status: 'Pending' | 'Approved' | 'Rejected';
    approvedById?: string;
    decisionDate?: Date;
    autoApproved: boolean;
  };
  acknowledgements: Array<{
    userId: string;
    acknowledged: boolean;
    acknowledgedAt?: Date;
  }>;
  assignment: {
    assignedToId?: string;
    claimedAt?: Date;
    rejectionReason?: string;
    forwardHistory: Array<{
      fromDepartment: string;
      toDepartment: string;
      assignedToId?: string;
      reason: string;
      movedAt: Date;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  _id: string;
  name: string;
  price: number;
  description?: string;
  category: string;
  specialOffers?: string;
  isActive: boolean;
}

export interface DiscountLimit {
  _id?: string;
  roleLimits: Array<{
    roleId: string;
    maxDiscountPercent: number;
  }>;
  individualLimits: Array<{
    userId: string;
    maxDiscountPercent: number;
  }>;
  history: Array<{
    changedBy: string;
    details: string;
    changedAt: Date;
  }>;
}

export interface AILog {
  _id: string;
  userId: string;
  rawText: string;
  parsed: {
    title: string;
    type: 'Call' | 'Meeting' | 'Demo' | 'FollowUp' | 'Other';
    dateStr: string;
    timeStr: string;
    schoolMentioned?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    urgency: 'Low' | 'Medium' | 'High';
    notes: string;
    confidence?: number;
    missingFields?: string[];
  };
  leadId?: string;
  taskId?: string;
  status: 'Parsed' | 'Confirmed';
  createdAt: Date;
  confirmedAt?: Date;
}

export interface Notification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: 'RequestApproval' | 'RequestStatus' | 'CalendarInvite' | 'TaskStatus' | 'QuoteApproval' | 'QuoteStatus';
  targetUrl: string;
  isRead: boolean;
  createdAt: Date;
}
