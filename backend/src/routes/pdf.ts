import { Router } from 'express';
import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Leads, Quotations } from '../models/db.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = join(__dirname, '../../assets/fonts/Sarabun-Regular.ttf');

function money(value: number) {
  return `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB`;
}

function buildPdf(lines: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Sarabun', FONT_PATH);
    doc.font('Sarabun').fontSize(10);

    let y = doc.y;
    lines.forEach(line => {
      if (y > 780) {
        doc.addPage();
        y = 48;
      }
      doc.text(line || '', 48, y, { width: 500 });
      y += line === '' ? 10 : 18;
    });

    doc.end();
  });
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
    'NEXTGEN Sale & Support Co., Ltd.',
    'ใบเสนอราคา (Official Quotation Document)',
    `เลขที่เอกสาร: ${quote.quoteNumber} / Rev.${quote.version || 1}`,
    `ลูกค้า: ${lead?.schoolName || quote.leadId || '-'}`,
    `สถานะ: ${quote.status}`,
    `สถานะอีเมล: ${quote.emailStatus || 'Draft'}`,
    `การยอมรับ: ${quote.signatureStatus || 'Pending'}`,
    `วันที่สร้าง: ${new Date(quote.createdAt).toLocaleDateString('th-TH')}`,
    `วันหมดอายุ: ${quote.expiresAt ? new Date(quote.expiresAt).toLocaleDateString('th-TH') : '-'}`,
    '',
    'รายการสินค้า',
    ...quote.items.map((item: any, index: number) =>
      `${index + 1}. ${item.name} | จำนวน ${item.quantity} | ราคาต่อหน่วย ${money(item.price)} | ส่วนลด ${item.discountPercent}%`
    ),
    '',
    `ยอดรวมก่อนส่วนลด: ${money(subtotal)}`,
    `ส่วนลดท้ายบิล (${quote.overallDiscountPercent}%): ${money(overallDiscount)}`,
    `ภาษีมูลค่าเพิ่ม (${quote.vatPercent}%): ${money(vat)}`,
    `ยอดรวมสุทธิ: ${money(quote.totalAmount)}`,
    '',
    `เงื่อนไข: ${quote.terms || '-'}`,
    'เอกสารนี้จัดทำโดย NEXTGEN และควบคุมเลขที่เอกสารผ่านระบบ Sale & Support'
  ];

  try {
    const pdf = await buildPdf(lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quoteNumber}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('PDF generation failed:', err);
    res.status(500).json({ message: 'สร้างไฟล์ PDF ไม่สำเร็จ' });
  }
});

export default router;
