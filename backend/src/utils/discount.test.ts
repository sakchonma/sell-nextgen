import { describe, expect, it } from 'vitest';
import { getQuoteStatusForDiscount, getUserDiscountLimit, isDiscountOverLimit } from './discount.js';

describe('discount utilities', () => {
  const settings = {
    roleLimits: [
      { roleId: 'r_sales', maxDiscountPercent: 10 },
      { roleId: 'r_manager', maxDiscountPercent: 20 }
    ],
    individualLimits: [
      { userId: 'u_special', maxDiscountPercent: 15 }
    ]
  };

  it('prefers individual limit over role limit', () => {
    expect(getUserDiscountLimit(settings, { _id: 'u_special', roleId: 'r_sales' })).toBe(15);
  });

  it('falls back to role limit when no individual override exists', () => {
    expect(getUserDiscountLimit(settings, { _id: 'u_regular', roleId: 'r_manager' })).toBe(20);
  });

  it('uses default limit when no setting matches', () => {
    expect(getUserDiscountLimit(settings, { _id: 'u_unknown', roleId: 'r_unknown' })).toBe(10);
  });

  it('marks only discounts above the limit as over limit', () => {
    expect(isDiscountOverLimit(10, 10)).toBe(false);
    expect(isDiscountOverLimit(10.01, 10)).toBe(true);
  });

  it('maps discount checks to quote approval status', () => {
    expect(getQuoteStatusForDiscount(9, 10)).toBe('Approved');
    expect(getQuoteStatusForDiscount(12, 10)).toBe('PendingApproval');
  });
});
