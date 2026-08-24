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

function resolveAssetPath(fileName: string) {
  const candidates = [
    join(__dirname, '../../assets', fileName),
    join(process.cwd(), 'assets', fileName),
    join(process.cwd(), 'backend/assets', fileName),
  ];
  return candidates.find(path => existsSync(path));
}

const LOGO_FILE = 'nextgen-education-logo.png';
const LOGO_WIDTH = 112;
const LOGO_HEIGHT = 60;
const TABLE_BORDER = '#000000';
const HEADER_BG = '#e8e8e8';
const TABLE_COL_WIDTHS = [36, 228, 58, 92, 97];
const FOOTER_ROW_HEIGHT = 20;
const CELL_PAD = 5;

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

function columnX(tableX: number, colWidths: number[], colIndex: number) {
  let x = tableX;
  for (let i = 0; i < colIndex; i += 1) x += colWidths[i];
  return x;
}

function columnsWidth(colWidths: number[], fromCol: number, toCol: number) {
  return colWidths.slice(fromCol, toCol + 1).reduce((sum, width) => sum + width, 0);
}

function buildDescriptionBlocks(row: QuoteLineInput) {
  const blocks: Array<{ text: string; bold?: boolean }> = [
    { text: row.title, bold: true },
  ];
  if (row.subtitle) blocks.push({ text: row.subtitle, bold: true });
  if (row.gradeLine) blocks.push({ text: row.gradeLine, bold: true });
  if (row.scopeOfWork?.length) {
    blocks.push({ text: 'Scope of work', bold: true });
    row.scopeOfWork.forEach((line, index) => {
      blocks.push({ text: `${index + 1}. ${line}` });
    });
  }
  return blocks;
}

function measureDescriptionHeight(
  doc: InstanceType<typeof PDFDocument>,
  blocks: Array<{ text: string; bold?: boolean }>,
  width: number,
  setFont: (bold?: boolean, size?: number) => void,
) {
  let height = CELL_PAD * 2;
  blocks.forEach(block => {
    setFont(Boolean(block.bold), 9);
    height += doc.heightOfString(block.text, { width }) + 2;
  });
  return Math.max(48, height);
}

function drawDescriptionBlocks(
  doc: InstanceType<typeof PDFDocument>,
  blocks: Array<{ text: string; bold?: boolean }>,
  x: number,
  y: number,
  width: number,
  setFont: (bold?: boolean, size?: number) => void,
) {
  let cursorY = y + CELL_PAD;
  blocks.forEach(block => {
    setFont(Boolean(block.bold), 9);
    doc.fillColor('#111111').text(block.text, x + CELL_PAD, cursorY, { width: width - CELL_PAD * 2 });
    cursorY += doc.heightOfString(block.text, { width: width - CELL_PAD * 2 }) + 2;
  });
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
    const tableRows = lines.length > 0
      ? lines
      : [{ index: 1, title: '-', quantity: 0, unitPrice: 0, lineTotal: 0 } as QuoteLineInput];

    const contacts = (lead?.contacts as Array<{ phone?: string }>) || [];
    const customerName = String(lead?.schoolName || quote.customerName || '-');
    const customerAddress = String(lead?.address || '').trim()
      || [lead?.district, lead?.province].filter(Boolean).join(' ');
    const customerTaxId = String(quote.customerTaxId || lead?.taxId || '').trim();
    const customerTel = String(contacts[0]?.phone || '').trim();

    let y = 32;
    const headerTop = y;
    const logoPath = resolveAssetPath(LOGO_FILE);
    const companyX = logoPath ? MARGIN_LEFT + LOGO_WIDTH + 14 : MARGIN_LEFT;
    const companyWidth = logoPath ? CONTENT_WIDTH - LOGO_WIDTH - 14 : CONTENT_WIDTH;

    if (logoPath) {
      doc.image(logoPath, MARGIN_LEFT, headerTop, {
        fit: [LOGO_WIDTH, LOGO_HEIGHT],
      });
    }

    const setFont = (bold = false, size = 11) => {
      doc.font(bold ? 'Sarabun-Bold' : 'Sarabun').fontSize(size);
      doc.fillColor('#111111');
    };

    let companyY = headerTop;
    setFont(true, 12);
    doc.text(QUOTATION_COMPANY.name, companyX, companyY, { width: companyWidth, align: 'right' });
    companyY += 16;
    setFont(false, 10);
    const addressHeight = doc.heightOfString(QUOTATION_COMPANY.address, { width: companyWidth, align: 'right' });
    doc.text(QUOTATION_COMPANY.address, companyX, companyY, { width: companyWidth, align: 'right' });
    companyY += addressHeight + 2;
    doc.text(`Tax ID: ${QUOTATION_COMPANY.taxId}  Tel. ${QUOTATION_COMPANY.tel}`, companyX, companyY, {
      width: companyWidth,
      align: 'right',
    });
    companyY += 12;
    doc.text(QUOTATION_COMPANY.fax, companyX, companyY, { width: companyWidth, align: 'right' });

    y = Math.max(headerTop + LOGO_HEIGHT, companyY + 12) + 10;

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
    const colWidths = TABLE_COL_WIDTHS;
    const headerHeight = 24;
    const footerHeight = FOOTER_ROW_HEIGHT * 3;
    const descColWidth = colWidths[1];

    const dataRowHeights = tableRows.map(row => {
      const blocks = buildDescriptionBlocks(row);
      return measureDescriptionHeight(doc, blocks, descColWidth, setFont);
    });
    const bodyHeight = dataRowHeights.reduce((sum, height) => sum + height, 0);
    const tableHeight = headerHeight + bodyHeight + footerHeight;

    doc.rect(tableX, y, CONTENT_WIDTH, tableHeight).stroke(TABLE_BORDER);

    for (let col = 1; col < colWidths.length; col += 1) {
      const lineX = columnX(tableX, colWidths, col);
      doc.moveTo(lineX, y).lineTo(lineX, y + tableHeight).stroke(TABLE_BORDER);
    }

    doc.rect(tableX, y, CONTENT_WIDTH, headerHeight).fillAndStroke(HEADER_BG, TABLE_BORDER);
    const headers = ['ลำดับ', 'รายการ', 'จำนวนคน', 'ราคาต่อหน่วย', 'จำนวนเงิน'];
    headers.forEach((header, index) => {
      setFont(true, 9);
      const cellX = columnX(tableX, colWidths, index);
      doc.fillColor('#111111').text(header, cellX, y + 7, {
        width: colWidths[index],
        align: 'center',
      });
    });

    let rowY = y + headerHeight;
    doc.moveTo(tableX, rowY).lineTo(tableX + CONTENT_WIDTH, rowY).stroke(TABLE_BORDER);

    tableRows.forEach((row, rowIndex) => {
      const rowHeight = dataRowHeights[rowIndex];
      const blocks = buildDescriptionBlocks(row);

      setFont(false, 9);
      doc.text(String(row.index), columnX(tableX, colWidths, 0), rowY + CELL_PAD, {
        width: colWidths[0],
        align: 'center',
      });
      drawDescriptionBlocks(doc, blocks, columnX(tableX, colWidths, 1), rowY, colWidths[1], setFont);
      doc.text(String(row.quantity), columnX(tableX, colWidths, 2) + CELL_PAD, rowY + CELL_PAD, {
        width: colWidths[2] - CELL_PAD * 2,
        align: 'center',
      });
      doc.text(formatMoney(row.unitPrice), columnX(tableX, colWidths, 3) + CELL_PAD, rowY + CELL_PAD, {
        width: colWidths[3] - CELL_PAD * 2,
        align: 'right',
      });
      doc.text(formatMoney(row.lineTotal), columnX(tableX, colWidths, 4) + CELL_PAD, rowY + CELL_PAD, {
        width: colWidths[4] - CELL_PAD * 2,
        align: 'right',
      });

      rowY += rowHeight;
      if (rowIndex < tableRows.length - 1) {
        doc.moveTo(tableX, rowY).lineTo(tableX + CONTENT_WIDTH, rowY).stroke(TABLE_BORDER);
      }
    });

    const footerY = y + headerHeight + bodyHeight;
    doc.moveTo(tableX, footerY).lineTo(tableX + CONTENT_WIDTH, footerY).stroke(TABLE_BORDER);

    const wordsBoxWidth = columnsWidth(colWidths, 0, 2);
    const totalsX = tableX + wordsBoxWidth;
    const totalsWidth = columnsWidth(colWidths, 3, 4);
    const labelWidth = colWidths[3];
    const valueWidth = colWidths[4];

    doc.moveTo(totalsX, footerY).lineTo(totalsX, footerY + footerHeight).stroke(TABLE_BORDER);
    doc.moveTo(totalsX + labelWidth, footerY).lineTo(totalsX + labelWidth, footerY + footerHeight).stroke(TABLE_BORDER);

    for (let footerRow = 1; footerRow < 3; footerRow += 1) {
      const lineY = footerY + footerRow * FOOTER_ROW_HEIGHT;
      doc.moveTo(totalsX, lineY).lineTo(totalsX + totalsWidth, lineY).stroke(TABLE_BORDER);
    }

    const amountWords = thaiBahtText(totals.grandTotal);
    setFont(true, 10);
    const wordsTextHeight = doc.heightOfString(amountWords, { width: wordsBoxWidth - CELL_PAD * 2 });
    const wordsTextY = footerY + Math.max(CELL_PAD, (footerHeight - wordsTextHeight) / 2);
    doc.text(amountWords, tableX + CELL_PAD, wordsTextY, {
      width: wordsBoxWidth - CELL_PAD * 2,
      align: 'center',
    });

    const footerTotals = [
      { label: 'รวมราคา', value: formatMoney(totals.beforeVat), bold: false },
      { label: `ภาษีมูลค่าเพิ่ม ${totals.vatPercent}%`, value: formatMoney(totals.vat), bold: false },
      { label: 'จำนวนเงินรวมทั้งสิ้น', value: formatMoney(totals.grandTotal), bold: true },
    ];

    footerTotals.forEach((row, index) => {
      const cellY = footerY + index * FOOTER_ROW_HEIGHT;
      setFont(row.bold, 9);
      doc.text(row.label, totalsX + CELL_PAD, cellY + 5, {
        width: labelWidth - CELL_PAD * 2,
        align: 'left',
      });
      doc.text(row.value, totalsX + labelWidth + CELL_PAD, cellY + 5, {
        width: valueWidth - CELL_PAD * 2,
        align: 'right',
      });
    });

    y += tableHeight + 14;

    setFont(true, 10);
    doc.text('หมายเหตุ:', MARGIN_LEFT, y);
    y += 14;
    setFont(false, 9.5);
    const bankLine = `1. โอนเงินเข้าบัญชี ${QUOTATION_COMPANY.bankName} ${QUOTATION_COMPANY.bankAccountType} เลขที่ ${QUOTATION_COMPANY.bankAccountNumber} จำนวนเงินรวมทั้งสิ้น ${formatMoney(totals.grandTotal)}`;
    doc.text(bankLine, MARGIN_LEFT + 4, y, { width: CONTENT_WIDTH - 4 });
    y += doc.heightOfString(bankLine, { width: CONTENT_WIDTH - 4 }) + 4;
    const boiLine = `2. ${QUOTATION_COMPANY.boiCertificate}`;
    doc.text(boiLine, MARGIN_LEFT + 4, y, { width: CONTENT_WIDTH - 4 });
    y += doc.heightOfString(boiLine, { width: CONTENT_WIDTH - 4 }) + 22;

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

    const signY = sigBlockY + 48;
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
