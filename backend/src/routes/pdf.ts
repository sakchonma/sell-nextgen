import { Router } from 'express';
import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Leads, Quotations } from '../models/db.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveFontPath(fileName: string) {
  const candidates = [
    join(__dirname, '../../assets/fonts', fileName),
    join(process.cwd(), 'assets/fonts', fileName),
    join(process.cwd(), 'backend/assets/fonts', fileName),
  ];
  const found = candidates.find(path => existsSync(path));
  if (!found) {
    throw new Error(`ไม่พบไฟล์ฟอนต์ ${fileName} — ตรวจสอบโฟลเดอร์ backend/assets/fonts`);
  }
  return found;
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
}

function buildPdf(lines: Array<{ text: string; bold?: boolean; size?: number; gap?: number }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const regularFont = resolveFontPath('Sarabun-Regular.ttf');
    const boldFont = resolveFontPath('Sarabun-Bold.ttf');
    doc.registerFont('Sarabun', regularFont);
    doc.registerFont('Sarabun-Bold', boldFont);

    let y = doc.y;
    lines.forEach(line => {
      const fontSize = line.size || 11;
      const gap = line.gap ?? (line.text === '' ? 8 : 20);
      if (y > 780) {
        doc.addPage();
        y = 48;
      }
      doc.font(line.bold ? 'Sarabun-Bold' : 'Sarabun').fontSize(fontSize);
      doc.text(line.text || '', 48, y, { width: 500, lineGap: 2 });
      y += gap;
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
    { text: 'NEXTGEN Sale & Support Co., Ltd.', bold: true, size: 14, gap: 24 },
    { text: 'ใบเสนอราคา (Official Quotation Document)', bold: true, size: 13, gap: 22 },
    { text: `เลขที่เอกสาร: ${quote.quoteNumber} / Rev.${quote.version || 1}` },
    { text: `ลูกค้า: ${lead?.schoolName || quote.leadId || '-'}` },
    { text: `สถานะ: ${quote.status}` },
    { text: `สถานะอีเมล: ${quote.emailStatus || 'Draft'}` },
    { text: `การยอมรับ: ${quote.signatureStatus || 'Pending'}` },
    { text: `วันที่สร้าง: ${new Date(quote.createdAt).toLocaleDateString('th-TH')}` },
    { text: `วันหมดอายุ: ${quote.expiresAt ? new Date(quote.expiresAt).toLocaleDateString('th-TH') : '-'}` },
    { text: '', gap: 8 },
    { text: 'รายการสินค้า', bold: true, size: 12, gap: 18 },
    ...quote.items.map((item: any, index: number) => ({
      text: `${index + 1}. ${item.name} | จำนวน ${item.quantity} | ราคาต่อหน่วย ${money(item.price)} | ส่วนลด ${item.discountPercent}%`,
    })),
    { text: '', gap: 8 },
    { text: `ยอดรวมก่อนส่วนลด: ${money(subtotal)}` },
    { text: `ส่วนลดท้ายบิล (${quote.overallDiscountPercent}%): ${money(overallDiscount)}` },
    { text: `ภาษีมูลค่าเพิ่ม (${quote.vatPercent}%): ${money(vat)}` },
    { text: `ยอดรวมสุทธิ: ${money(quote.totalAmount)}`, bold: true, size: 12, gap: 22 },
    { text: '', gap: 8 },
    { text: `เงื่อนไข: ${quote.terms || '-'}` },
    { text: 'เอกสารนี้จัดทำโดย NEXTGEN และควบคุมเลขที่เอกสารผ่านระบบ Sale & Support' },
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
