export interface DiscountSettingsLike {
  roleLimits?: Array<{
    roleId: string;
    maxDiscountPercent: number;
  }>;
  individualLimits?: Array<{
    userId: string;
    maxDiscountPercent: number;
  }>;
}

export interface DiscountUserLike {
  _id: string;
  roleId: string;
}

export function getUserDiscountLimit(
  settings: DiscountSettingsLike | null | undefined,
  user: DiscountUserLike,
  fallbackLimit = 10
): number {
  const individualLimit = settings?.individualLimits?.find(limit => limit.userId === user._id);
  if (individualLimit) return Number(individualLimit.maxDiscountPercent);

  const roleLimit = settings?.roleLimits?.find(limit => limit.roleId === user.roleId);
  if (roleLimit) return Number(roleLimit.maxDiscountPercent);

  return fallbackLimit;
}

export function isDiscountOverLimit(discountPercent: number, limitPercent: number): boolean {
  return Number(discountPercent || 0) > Number(limitPercent || 0);
}

export function getQuoteStatusForDiscount(discountPercent: number, limitPercent: number) {
  return isDiscountOverLimit(discountPercent, limitPercent) ? 'PendingApproval' as const : 'Approved' as const;
}
