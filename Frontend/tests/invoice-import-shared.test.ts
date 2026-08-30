import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDateOnly,
  formatLocalDate,
  normalizeImportDrafts,
  type ImportInvoiceDraft,
} from '../app/pc/invoices/_components/shared';

function draft(id: string): ImportInvoiceDraft {
  return {
    id,
    fileName: `${id}.png`,
    sourceFile: new File([], `${id}.png`),
    payload: {
      invoiceno: '',
      supplier: 'Example Supplier',
      userid: 'jiawu',
      invoicedate: '2026-08-29',
    },
    raw: {
      seller_tax_no: '913100000000000000',
      seller_name: 'Example Supplier',
      issue_date: '2026-08-29',
    },
  };
}

test('generates receipt invoice numbers and skips existing sequences', () => {
  const rows = normalizeImportDrafts(
    [draft('receipt-1'), draft('receipt-2')],
    new Set(['913100000000000000-20260829-001']),
    (_key, fallback) => fallback,
  );

  assert.equal(rows[0].payload.invoiceno, '913100000000000000-20260829-002');
  assert.equal(rows[1].payload.invoiceno, '913100000000000000-20260829-003');
  assert.equal(rows[0].payload.taxamount, 0);
  assert.equal(rows[1].payload.taxamount, 0);
  assert.equal(rows[0].generatedInvoiceNo, true);
  assert.equal(rows[1].generatedInvoiceNo, true);
  assert.equal(rows[0].skipReason, undefined);
  assert.equal(rows[1].skipReason, undefined);
});

test('defaults a missing receipt date to the local upload date', () => {
  const missingDateDraft = draft('receipt-no-date');
  missingDateDraft.payload.invoicedate = '';
  missingDateDraft.raw = {
    seller_name: '',
    seller_tax_no: '',
    issue_date: '',
  };

  const rows = normalizeImportDrafts(
    [missingDateDraft],
    new Set(),
    (_key, fallback) => fallback,
  );

  const expectedDate = formatLocalDate();
  assert.equal(rows[0].payload.invoicedate, expectedDate);
  assert.equal(rows[0].payload.invoiceno, `RECEIPT-${expectedDate.replaceAll('-', '')}-001`);
  assert.equal(rows[0].payload.taxamount, 0);
  assert.equal(rows[0].skipReason, undefined);
});

test('updates a generated receipt number when its date is edited', () => {
  const initial = normalizeImportDrafts(
    [
      {
        ...draft('receipt-date-edit'),
        payload: {
          ...draft('receipt-date-edit').payload,
          invoicedate: '',
        },
        raw: {
          seller_name: '',
          seller_tax_no: '',
          issue_date: '',
        },
      },
    ],
    new Set(),
    (_key, fallback) => fallback,
  )[0];

  const updated = normalizeImportDrafts(
    [
      {
        ...initial,
        payload: {
          ...initial.payload,
          invoicedate: '2026-09-01',
        },
      },
    ],
    new Set(),
    (_key, fallback) => fallback,
  )[0];

  assert.equal(updated.payload.invoicedate, '2026-09-01');
  assert.equal(updated.payload.invoiceno, 'RECEIPT-20260901-001');
  assert.equal(updated.payload.taxamount, 0);
  assert.equal(updated.generatedInvoiceNo, true);
  assert.equal(updated.skipReason, undefined);
});

test('keeps invoice calendar dates stable across UTC serialization', () => {
  assert.equal(formatDateOnly('2024-12-06'), '2024-12-06');
  assert.equal(formatDateOnly('2024-12-05T16:00:00.000Z'), '2024-12-06');
  assert.equal(formatLocalDate(new Date('2026-08-28T16:30:00.000Z')), '2026-08-29');
});
