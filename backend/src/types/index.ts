export interface User {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
  rank: number;
  status?: 'active' | 'inactive' | 'suspended';
  zone?: string;
  avatarUrl?: string;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  forcePasswordChange?: boolean;
  notificationPreferences?: {
    categories?: {
      Request?: boolean;
      Quote?: boolean;
      Task?: boolean;
      Calendar?: boolean;
      System?: boolean;
    };
    digestOnly?: boolean;
  };
  createdBy?: string;
  updatedBy?: string;
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
  stage: 'New Lead' | 'Contacted' | 'Interested' | 'Demo Scheduled' | 'Proposal Sent' | 'Pilot/Trial' | 'Closed Won' | 'Closed Lost';
  score: number;
  gradeLevels?: string;
  educationAuthority?: string;
  district?: string;
  province?: string;
  studentCount?: number;
  upperElementaryStudentCount?: number;
  lastContactedAt?: string;
  nextCallAt?: string;
  documentStatus?: string;
  remarks?: string;
  legacySaleName?: string;
  source?: string;
  campaign?: string;
  archived?: boolean;
  contacts: Array<{
    name: string;
    position: string;
    phone: string;
    email?: string;
  }>;
  assignedTo: string;
  assignmentHistory?: Array<{
    fromUserId?: string;
    toUserId: string;
    changedBy: string;
    reason?: string;
    changedAt: Date;
  }>;
  notes: Array<{
    author: string;
    content: string;
    type?: 'General' | 'Call' | 'Meeting' | 'Coaching' | 'FollowUp';
    createdAt: Date;
  }>;
  attachments?: Array<{
    name: string;
    url: string;
    type?: string;
    uploadedAt: Date;
    uploadedBy?: string;
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
  probability?: number;
  lostReason?: string;
  quoteIds?: string[];
  stageHistory?: Array<{
    fromStage?: string;
    toStage: string;
    changedBy: string;
    reason?: string;
    changedAt: Date;
  }>;
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
  opportunityId?: string;
  requestId?: string;
  reminderAt?: Date;
  recurrenceId?: string;
  recurrenceRule?: 'none' | 'daily' | 'weekly' | 'monthly';
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
  version?: number;
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
  requiredApprovalRank?: 4 | 5;
  approvedById?: string;
  rejectionReason?: string;
  approvalTrail?: Array<{
    status: 'Approved' | 'Rejected' | 'PendingApproval';
    actorId: string;
    actorName?: string;
    reason?: string;
    decidedAt: Date;
  }>;
  revisions?: Array<{
    version: number;
    changedBy: string;
    changedAt: Date;
    reason?: string;
    snapshot: Record<string, unknown>;
  }>;
  sentAt?: Date;
  sentById?: string;
  sentToEmail?: string;
  emailStatus?: 'Draft' | 'Queued' | 'Sent' | 'Failed';
  expiresAt?: Date;
  terms?: string;
  signatureStatus?: 'Pending' | 'Accepted' | 'Declined';
  acceptedAt?: Date;
  acceptedByName?: string;
  convertedOpportunityId?: string;
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
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  slaDueAt?: Date;
  isDraft?: boolean;
  attachments?: Array<{
    name: string;
    url?: string;
    uploadedBy: string;
    uploadedAt: Date;
  }>;
  comments?: Array<{
    authorId: string;
    authorName: string;
    content: string;
    createdAt: Date;
  }>;
  statusHistory?: Array<{
    fromStatus?: string;
    toStatus: string;
    actorId: string;
    actorName?: string;
    reason?: string;
    changedAt: Date;
  }>;
  startAt: Date;
  endAt: Date;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Acknowledged' | 'Claimed' | 'Completed';
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
  priceHistory?: Array<{
    price: number;
    changedBy: string;
    changedAt: Date;
    reason?: string;
  }>;
  deletedAt?: Date;
  deletedBy?: string;
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
  promptVersion?: string;
  provider?: 'gemini' | 'fallback';
  usage?: {
    inputChars: number;
    estimatedTokens: number;
    latencyMs?: number;
    estimatedCostUsd?: number;
  };
  guardrails?: {
    requiresReview: boolean;
    reviewReasons: string[];
    confirmedBy?: string;
  };
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
  category?: 'Request' | 'Quote' | 'Task' | 'Calendar' | 'System';
  isRead: boolean;
  archivedAt?: Date;
  createdAt: Date;
}

export interface AuditLog {
  _id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  targetEmail?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}
