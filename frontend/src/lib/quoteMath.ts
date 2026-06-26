export interface QuoteItemLike {
  price: number;
  quantity: number;
  discountPercent?: number;
}

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

export interface UserLike {
  _id: string;
  roleId: string;
}

export function calculateQuoteTotals(
  items: QuoteItemLike[],
  overallDiscountPercent: number,
  vatPercent: number
) {
  const gross = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const lineDiscount = items.reduce((sum, item) => {
    const line = Number(item.price || 0) * Number(item.quantity || 0);
    return sum + line * (Number(item.discountPercent || 0) / 100);
  }, 0);
  const afterLineDiscount = gross - lineDiscount;
  const overallDiscount = afterLineDiscount * (Number(overallDiscountPercent || 0) / 100);
  const beforeVat = afterLineDiscount - overallDiscount;
  const vat = beforeVat * (Number(vatPercent || 0) / 100);
  const total = beforeVat + vat;

  return { gross, lineDiscount, afterLineDiscount, overallDiscount, beforeVat, vat, total };
}

export function getUserDiscountLimit(
  settings: DiscountSettingsLike,
  user: UserLike | null | undefined,
  fallbackLimit = 10
) {
  if (!user) return fallbackLimit;
  const individual = settings.individualLimits?.find(item => item.userId === user._id);
  if (individual) return Number(individual.maxDiscountPercent);
  const byRole = settings.roleLimits?.find(item => item.roleId === user.roleId);
  return Number(byRole?.maxDiscountPercent ?? fallbackLimit);
}

export function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
