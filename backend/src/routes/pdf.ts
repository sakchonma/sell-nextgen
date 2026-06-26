import { Router } from 'express';
import type { Request, Response } from 'express';
import { Leads, Quotations } from '../models/db.js';

const router = Router();

function asciiOnly(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/[\\()]/g, '\\$&');
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB`;
}

function buildPdf(lines: string[]) {
  const contentLines = lines.map((line, index) => {
    const y = 760 - index * 18;
    return `BT /F1 10 Tf 48 ${y} Td (${asciiOnly(line)}) Tj ET`;
  });
  const content = contentLines.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`
  ];

  let offset = '%PDF-1.4\n'.length;
  const xref = ['0000000000 65535 f '];
  const body = objects.map(obj => {
    xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
    offset += Buffer.byteLength(`${obj}\n`);
    return `${obj}\n`;
  }).join('');
  const startxref = Buffer.byteLength(`%PDF-1.4\n${body}`);
  const pdf = `%PDF-1.4\n${body}xref\n0 ${objects.length + 1}\n${xref.join('\n')}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;
  return Buffer.from(pdf);
}

router.get('/:id/pdf', async (req: Request, res: Response) => {
  const quote = await Quotations().findOne({ _id: req.params.id } as any);
  if (!quote) {
    return res.status(404).json({ message: 'ไม่พบใบเสนอราคา' });
  }

  const lead = quote.leadId ? await Leads().findOne({ _id: quote.leadId } as any) : null;
  const subtotal = quote.items.reduce((sum: number, item: any) => {
    const line = Number(item.price || 0) * Number(item.quantity || 0);
    const discount = line * (Number(item.discountPercent || 0) / 100);
    return sum + line - discount;
  }, 0);
  const overallDiscount = subtotal * (Number(quote.overallDiscountPercent || 0) / 100);
  const beforeVat = subtotal - overallDiscount;
  const vat = beforeVat * (Number(quote.vatPercent || 0) / 100);

  const lines = [
    'NEXTGEN Sale & Support',
    `Quotation: ${quote.quoteNumber}`,
    `Customer: ${lead?.schoolName || quote.leadId || '-'}`,
    `Status: ${quote.status}`,
    `Created: ${new Date(quote.createdAt).toLocaleDateString('en-GB')}`,
    '',
    'Items',
    ...quote.items.map((item: any, index: number) =>
      `${index + 1}. ${item.name} | Qty ${item.quantity} | Unit ${money(item.price)} | Disc ${item.discountPercent}%`
    ),
    '',
    `Subtotal: ${money(subtotal)}`,
    `Overall discount (${quote.overallDiscountPercent}%): ${money(overallDiscount)}`,
    `VAT (${quote.vatPercent}%): ${money(vat)}`,
    `Grand total: ${money(quote.totalAmount)}`
  ];

  const pdf = buildPdf(lines);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${quote.quoteNumber}.pdf"`);
  res.send(pdf);
});

export default router;
