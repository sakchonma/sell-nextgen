export type EntityStatus = 'Draft' | 'Pending' | 'PendingApproval' | 'Approved' | 'Rejected' | 'Completed' | 'Claimed';

export interface ProductRecord {
  _id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  specialOffers?: string;
  isActive: boolean;
  priceHistory?: Array<{
    price: number;
    changedBy: string;
    changedAt: string;
    reason?: string;
  }>;
  deletedAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
