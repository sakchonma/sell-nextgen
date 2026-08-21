import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEFAULT_CLEVER_EXERCISE_SCOPE, QUOTATION_COMPANY } from '../config/quotation-company.js';
import { thaiBahtText } from './thai-baht-text.js';

const MARGIN_LEFT = 42;
const MARGIN_RIGHT = 42;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
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

function formatThaiDate(date: Date | string | undefined) {
  const value = date ? new Date(date) : new Date();
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = value.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface QuoteLineInput {
  index: number;
  title: string;
  subtitle?: string;
  gradeLine?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  scopeOfWork?: string[];
}

export interface BuildQuotationPdfInput {
  quote: Record<string, unknown>;
  lead: Record<string, unknown> | null;
  creator: Record<string, unknown> | null;
}

function itemLineTotal(item: Record<string, unknown>) {
  const qty = Number(item.quantity || 0);
  const price = Number(item.price || item.unitPrice || 0);
  const discount = Number(item.discountPercent || 0);
  const gross = qty * price;
  return gross - gross * (discount / 100);
}

function buildQuoteLines(quote: Record<string, unknown>, lead: Record<string, unknown> | null): QuoteLineInput[] {
  const items = (quote.items as Record<string, unknown>[]) || [];
  return items.map((item, index) => {
    const title = String(item.name || 'รายการสินค้า/บริการ');
    const subtitle = String(item.subtitle || item.packageLabel || item.description || '').trim();
    const gradeLevels = String(item.gradeLevels || '').trim();
    const leadGrades = String(lead?.gradeLevels || '').trim();
    const gradeLine = gradeLevels || (leadGrades ? `นักเรียนระดับชั้น ${leadGrades}` : '');

    let scopeOfWork = item.scopeOfWork as string[] | undefined;
    if (!scopeOfWork?.length && (item.productCategory === 'clever_exercise' || /clever/i.test(title))) {
      scopeOfWork = [...DEFAULT_CLEVER_EXERCISE_SCOPE];
    }

    return {
      index: index + 1,
      title,
      subtitle: subtitle || undefined,
      gradeLine: gradeLine || undefined,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.price || item.unitPrice || 0),
      lineTotal: itemLineTotal(item),
      scopeOfWork: scopeOfWork?.length ? scopeOfWork : undefined,
    };
  });
}

function calcTotals(quote: Record<string, unknown>) {
  const items = (quote.items as Record<string, unknown>[]) || [];
  const subtotal = items.reduce((sum, item) => sum + itemLineTotal(item), 0);
  const overallDiscount = subtotal * (Number(quote.overallDiscountPercent || 0) / 100);
  const beforeVat = subtotal - overallDiscount;
  const vatPercent = Number(quote.vatPercent || 0);
  const vat = beforeVat * (vatPercent / 100);
  const storedTotal = Number(quote.totalAmount || 0);
  const grandTotal = storedTotal > 0 ? storedTotal : beforeVat + vat;
  return { subtotal, overallDiscount, beforeVat, vatPercent, vat, grandTotal };
}

export function buildQuotationPdf(input: BuildQuotationPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Sarabun', resolveFontPath('Sarabun-Regular.ttf'));
    doc.registerFont('Sarabun-Bold', resolveFontPath('Sarabun-Bold.ttf'));

    const { quote, lead, creator } = input;
    const lines = buildQuoteLines(quote, lead);
    const totals = calcTotals(quote);
    const allScope = lines.flatMap(line => line.scopeOfWork || []);

    const contacts = (lead?.contacts as Array<{ phone?: string }>) || [];
    const customerName = String(lead?.schoolName || quote.customerName || '-');
    const customerAddress = String(lead?.address || '').trim()
      || [lead?.district, lead?.province].filter(Boolean).join(' ');
    const customerTaxId = String(quote.customerTaxId || lead?.taxId || '').trim();
    const customerTel = String(contacts[0]?.phone || '').trim();

    let y = 36;

    const setFont = (bold = false, size = 11) => {
      doc.font(bold ? 'Sarabun-Bold' : 'Sarabun').fontSize(size);
      doc.fillColor('#111111');
    };

    setFont(true, 12);
    doc.text(QUOTATION_COMPANY.name, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'right' });
    y += 16;
    setFont(false, 10);
    doc.text(QUOTATION_COMPANY.address, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'right' });
    y += 14;
    doc.text(`Tax ID: ${QUOTATION_COMPANY.taxId}  Tel. ${QUOTATION_COMPANY.tel}`, MARGIN_LEFT, y, {
      width: CONTENT_WIDTH,
      align: 'right',
    });
    y += 12;
    doc.text(QUOTATION_COMPANY.fax, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'right' });
    y += 22;

    setFont(true, 15);
    doc.text('ใบเสนอราคา / QUOTATION', MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
    y += 30;

    const leftColWidth = CONTENT_WIDTH * 0.4;
    const rightColX = MARGIN_LEFT + leftColWidth + 10;
    const rightColWidth = CONTENT_WIDTH - leftColWidth - 10;
    const metaY = y;

    setFont(false, 10);
    doc.text(`เลขที่ No. ${quote.quoteNumber}`, MARGIN_LEFT, metaY);
    doc.text(`วันที่ Date. ${formatThaiDate(quote.createdAt as string | Date)}`, MARGIN_LEFT, metaY + 14);

    doc.text(`ชื่อลูกค้า : ${customerName}`, rightColX, metaY, { width: rightColWidth });
    doc.text(`ที่อยู่ : ${customerAddress || ''}`, rightColX, metaY + 14, { width: rightColWidth });
    doc.text(`เลขประจำตัวผู้เสียภาษี : ${customerTaxId}`, rightColX, metaY + 28, { width: rightColWidth });
    if (customerTel) {
      doc.text(`Tel. : ${customerTel}`, rightColX, metaY + 42, { width: rightColWidth });
    }

    y = metaY + (customerTel ? 64 : 52);

    const tableX = MARGIN_LEFT;
    const colWidths = [34, 236, 64, 78, 83];
    const headers = ['ลำดับ', '', 'จำนวนคน', 'ราคาต่อหน่วย', 'จำนวนเงิน'];
    const headerHeight = 24;

    doc.rect(tableX, y, CONTENT_WIDTH, headerHeight).fillAndStroke('#f3f4f6', '#333333');
    let colX = tableX;
    headers.forEach((header, index) => {
      setFont(true, 9);
      const align = index === 0 ? 'center' : index >= 2 ? 'right' : 'left';
      const pad = index === 0 ? 0 : 4;
      doc.fillColor('#111111').text(header, colX + pad, y + 7, {
        width: colWidths[index] - pad * 2,
        align,
      });
      colX += colWidths[index];
    });
    y += headerHeight;

    const drawRow = (row: QuoteLineInput) => {
      const descParts = [row.title];
      if (row.subtitle) descParts.push(row.subtitle);
      if (row.gradeLine) descParts.push(row.gradeLine);
      const descText = descParts.join('\n');

      setFont(false, 9);
      const descHeight = doc.heightOfString(descText, { width: colWidths[1] - 8 });
      const rowHeight = Math.max(36, descHeight + 16);

      doc.rect(tableX, y, CONTENT_WIDTH, rowHeight).stroke('#cccccc');
      colX = tableX;

      doc.fillColor('#111111').text(String(row.index), colX, y + 10, { width: colWidths[0], align: 'center' });
      colX += colWidths[0];
      doc.text(descText, colX + 4, y + 8, { width: colWidths[1] - 8 });
      colX += colWidths[1];
      doc.text(String(row.quantity), colX, y + 10, { width: colWidths[2] - 4, align: 'right' });
      colX += colWidths[2];
      doc.text(formatMoney(row.unitPrice), colX, y + 10, { width: colWidths[3] - 4, align: 'right' });
      colX += colWidths[3];
      doc.text(formatMoney(row.lineTotal), colX, y + 10, { width: colWidths[4] - 4, align: 'right' });

      y += rowHeight;
    };

    if (lines.length === 0) {
      drawRow({ index: 1, title: '-', quantity: 0, unitPrice: 0, lineTotal: 0 });
    } else {
      lines.forEach(drawRow);
    }

    y += 14;

    if (allScope.length > 0) {
      setFont(true, 10);
      doc.text('Scope of work', MARGIN_LEFT, y);
      y += 14;
      setFont(false, 9.5);
      allScope.forEach((scopeLine, index) => {
        const text = `${index + 1}. ${scopeLine}`;
        doc.text(text, MARGIN_LEFT + 4, y, { width: CONTENT_WIDTH - 8 });
        y += doc.heightOfString(text, { width: CONTENT_WIDTH - 8 }) + 3;
      });
      y += 8;
    }

    setFont(true, 10);
    doc.text('รวมราคา', MARGIN_LEFT, y, { width: CONTENT_WIDTH - 90, align: 'right' });
    doc.text(formatMoney(totals.beforeVat), MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'right' });
    y += 16;

    setFont(false, 10);
    doc.text(`หมายเหตุ: ภาษีมูลค่าเพิ่ม ${totals.vatPercent}%`, MARGIN_LEFT, y, {
      width: CONTENT_WIDTH - 90,
      align: 'right',
    });
    doc.text(formatMoney(totals.vat), MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'right' });
    y += 18;

    setFont(false, 9.5);
    const bankLine = `1. โอนเงินเข้าบัญชี ${QUOTATION_COMPANY.bankName} ${QUOTATION_COMPANY.bankAccountType} เลขที่ ${QUOTATION_COMPANY.bankAccountNumber} จำนวนเงินรวมทั้งสิ้น ${formatMoney(totals.grandTotal)}`;
    doc.text(bankLine, MARGIN_LEFT, y, { width: CONTENT_WIDTH });
    y += doc.heightOfString(bankLine, { width: CONTENT_WIDTH }) + 4;
    const boiLine = `2. ${QUOTATION_COMPANY.boiCertificate}`;
    doc.text(boiLine, MARGIN_LEFT, y, { width: CONTENT_WIDTH });
    y += doc.heightOfString(boiLine, { width: CONTENT_WIDTH }) + 22;

    const sigColWidth = (CONTENT_WIDTH - 24) / 2;
    const sigLeftX = MARGIN_LEFT;
    const sigRightX = MARGIN_LEFT + sigColWidth + 24;
    const sigBlockY = Math.min(y, 640);

    setFont(false, 9);
    doc.text('วันที่ ....../......../..........', sigLeftX, sigBlockY, { width: sigColWidth, align: 'center' });
    doc.text(`วันที่ ${formatThaiDate(quote.createdAt as string | Date)}`, sigRightX, sigBlockY, {
      width: sigColWidth,
      align: 'center',
    });

    setFont(true, 10);
    doc.text('ผู้เสนอราคา', sigLeftX, sigBlockY + 18, { width: sigColWidth, align: 'center' });
    doc.text('ผู้รับบริการ', sigRightX, sigBlockY + 18, { width: sigColWidth, align: 'center' });

    setFont(false, 10);
    doc.text(thaiBahtText(totals.grandTotal), MARGIN_LEFT, sigBlockY + 42, {
      width: CONTENT_WIDTH,
      align: 'center',
    });

    const signY = sigBlockY + 72;
    doc.moveTo(sigLeftX + 28, signY).lineTo(sigLeftX + sigColWidth - 28, signY).stroke('#333333');
    setFont(true, 10);
    doc.text(QUOTATION_COMPANY.signatoryName, sigLeftX, signY + 6, { width: sigColWidth, align: 'center' });
    setFont(false, 9);
    doc.text(QUOTATION_COMPANY.signatoryRole, sigLeftX, signY + 20, { width: sigColWidth, align: 'center' });

    doc.moveTo(sigRightX + 28, signY).lineTo(sigRightX + sigColWidth - 28, signY).stroke('#333333');
    doc.text('…………………………………', sigRightX, signY + 6, { width: sigColWidth, align: 'center' });
    doc.text('ผู้มีอำนาจลงนาม / ตัวแทนโรงเรียน', sigRightX, signY + 20, { width: sigColWidth, align: 'center' });

    if (creator?.name) {
      setFont(false, 8);
      doc.fillColor('#666666').text(`จัดทำโดย: ${creator.name}`, MARGIN_LEFT, 805, {
        width: CONTENT_WIDTH,
        align: 'left',
      });
    }

    doc.end();
  });
}
