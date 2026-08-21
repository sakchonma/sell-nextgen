import { Router } from 'express';
import type { Request, Response } from 'express';
import { Leads, Quotations, Users } from '../models/db.js';
import { buildQuotationPdf } from '../lib/quotation-pdf.js';

const router = Router();

router.get('/:id/pdf', async (req: Request, res: Response) => {
  const quote = await Quotations().findOne({ _id: req.params.id } as any);
  if (!quote) {
    return res.status(404).json({ message: 'ไม่พบใบเสนอราคา' });
  }

  const lead = quote.leadId ? await Leads().findOne({ _id: quote.leadId } as any) : null;
  const creator = quote.creatorId ? await Users().findOne({ _id: quote.creatorId } as any) : null;

  try {
    const pdf = await buildQuotationPdf({
      quote: quote as Record<string, unknown>,
      lead: (lead as Record<string, unknown>) || null,
      creator: (creator as Record<string, unknown>) || null,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quoteNumber}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('PDF generation failed:', err);
    res.status(500).json({ message: 'สร้างไฟล์ PDF ไม่สำเร็จ' });
  }
});

export default router;
