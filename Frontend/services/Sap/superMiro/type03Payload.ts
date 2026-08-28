import { ServiceError } from '../../_core/error';
import type { CreateSuperMiroEInvoicePayload } from './types';
import type { SuperMiroReimbursementSource } from './reimbursementTypes';

function toSapText(value: unknown): string {
  return String(value ?? '').trim();
}

function formatSapSupplierId(value: unknown): string {
  const supplierId = toSapText(value);
  if (!supplierId) {
    return '';
  }
  if (supplierId.length > 10) {
    throw new ServiceError('SAP Supplier ID must not exceed 10 characters', { status: 400 });
  }
  return supplierId.padStart(10, '0');
}

function toRequiredAmount(value: unknown, field: string, invoiceNo: string): number {
  if (value === null || value === undefined || value === '') {
    throw new ServiceError(`${field} is required for invoice ${invoiceNo}`, { status: 400 });
  }
  const amount = Number(String(value).replace(/[，,]/g, '').trim());
  if (!Number.isFinite(amount)) {
    throw new ServiceError(`${field} is invalid for invoice ${invoiceNo}`, { status: 400 });
  }
  return amount;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatSapDecimal(value: number): string {
  return value.toFixed(2);
}

export function selectLocalizedBookingDescription(
  language: 'zh' | 'en',
  nameZh: unknown,
  nameEn: unknown,
): string {
  const preferred = language === 'en' ? toSapText(nameEn) : toSapText(nameZh);
  const fallback = language === 'en' ? toSapText(nameZh) : toSapText(nameEn);
  return preferred || fallback;
}

function formatBookingCode(code: unknown, description: unknown): string {
  const normalizedCode = toSapText(code);
  const normalizedDescription = toSapText(description);
  if (!normalizedCode) return normalizedDescription;
  if (!normalizedDescription) return normalizedCode;
  return `${normalizedCode} - ${normalizedDescription}`;
}

function readReimbursementNo(source: SuperMiroReimbursementSource): string {
  const number = toSapText(source.trno) || toSapText(source.id);
  if (!number) {
    throw new ServiceError('Reimbursement number is required for SAP posting', { status: 400 });
  }
  return number;
}

function normalizeIssueDate(value: unknown, invoiceNo: string): string {
  const text = toSapText(value);
  if (!text) {
    return '';
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(text);
  if (!match) {
    throw new ServiceError(`Invoice issue date must use YYYY-MM-DD for invoice ${invoiceNo}`, {
      status: 400,
    });
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new ServiceError(`Invoice issue date is invalid for invoice ${invoiceNo}`, {
      status: 400,
    });
  }
  return `${year}-${month}-${day}`;
}

export function buildType03SuperMiroPayloads(
  source: SuperMiroReimbursementSource,
): CreateSuperMiroEInvoicePayload[] {
  if (source.lines.length === 0) {
    throw new ServiceError(`Reimbursement ${source.id} has no invoice lines`, { status: 400 });
  }

  const reimbursementNo = readReimbursementNo(source);
  const normalizedLines = source.lines.map((line) => {
    const invoiceNo = toSapText(line.invoiceNo) || `line ${line.seqno}`;
    if (toSapText(line.businessType) !== '03') {
      throw new ServiceError(
        `Invoice ${invoiceNo} has unsupported business type ${toSapText(line.businessType) || '(empty)'}`,
        { status: 400 },
      );
    }
    if (!Number.isInteger(line.seqno) || line.seqno < 1) {
      throw new ServiceError(`Invoice ${invoiceNo} has invalid reimbursement line number`, {
        status: 400,
      });
    }

    return {
      line,
      amount: toRequiredAmount(line.amount, 'Reimbursement amount', invoiceNo),
      grossAmount: toRequiredAmount(line.grossAmount, 'Invoice total amount', invoiceNo),
      taxAmount: toRequiredAmount(line.taxAmount, 'Invoice tax amount', invoiceNo),
    };
  });

  const sumTotal = roundMoney(normalizedLines.reduce((sum, item) => sum + item.amount, 0));
  const sumTax = roundMoney(normalizedLines.reduce((sum, item) => sum + item.taxAmount, 0));
  const sumNetwr = roundMoney(sumTotal - sumTax);

  return normalizedLines.map(({ line, amount, grossAmount, taxAmount }) => ({
    Code: '',
    Lifnr: formatSapSupplierId(source.sapSupplierId),
    Vatno: toSapText(line.invoiceNo),
    Seqno: reimbursementNo,
    IssueDate: normalizeIssueDate(line.issueDate, toSapText(line.invoiceNo)),
    SellerName: toSapText(line.sellerName),
    BuyerName: '',
    Name: toSapText(line.description),
    Waers: toSapText(line.currency),
    UnitPrice: formatSapDecimal(amount),
    Netwr: formatSapDecimal(amount),
    Tax: formatSapDecimal(taxAmount),
    Note: toSapText(line.note),
    bookingCode: formatBookingCode(line.bookingCode, line.bookingDescription),
    Hkont: toSapText(line.hkont),
    Kostl: toSapText(line.kostl),
    SumTotal: formatSapDecimal(sumTotal),
    SumNetwr: formatSapDecimal(sumNetwr),
    SumTax: formatSapDecimal(sumTax),
    Taxrate: '',
    invoiceTranscationType: '03',
    // TotalAmt is the gross total of the invoice represented by this line.
    TotalAmt: formatSapDecimal(grossAmount),
  }));
}
