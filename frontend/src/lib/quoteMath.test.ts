import { describe, expect, it } from 'vitest';
import { calculateQuoteTotals, formatMoney, getUserDiscountLimit } from './quoteMath';

describe('quoteMath', () => {
  it('calculates line discount, overall discount, VAT, and grand total', () => {
    const totals = calculateQuoteTotals([
      { price: 1000, quantity: 2, discountPercent: 10 },
      { price: 500, quantity: 1, discountPercent: 0 }
    ], 5, 7);

    expect(totals.gross).toBe(2500);
    expect(totals.lineDiscount).toBe(200);
    expect(totals.afterLineDiscount).toBe(2300);
    expect(totals.overallDiscount).toBe(115);
    expect(totals.beforeVat).toBe(2185);
    expect(totals.vat).toBeCloseTo(152.95);
    expect(totals.total).toBeCloseTo(2337.95);
  });

  it('prefers individual discount limit over role limit', () => {
    expect(getUserDiscountLimit({
      roleLimits: [{ roleId: 'r_sales', maxDiscountPercent: 10 }],
      individualLimits: [{ userId: 'u4', maxDiscountPercent: 15 }]
    }, { _id: 'u4', roleId: 'r_sales' })).toBe(15);
  });

  it('formats Thai money values consistently', () => {
    expect(formatMoney(1234.5)).toBe('1,234.50');
  });
});
