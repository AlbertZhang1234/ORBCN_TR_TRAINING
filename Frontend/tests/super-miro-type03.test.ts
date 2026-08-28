import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildType03SuperMiroPayloads,
  selectLocalizedBookingDescription,
} from '../services/Sap/superMiro/type03Payload.ts';

test('booking description follows the selected system language', () => {
  assert.equal(selectLocalizedBookingDescription('zh', '出租车网约车', 'Taxi'), '出租车网约车');
  assert.equal(selectLocalizedBookingDescription('en', '出租车网约车', 'Taxi'), 'Taxi');
});

test('type 03 payload maps reimbursement lines and uses each invoice total for TotalAmt', () => {
  const payloads = buildType03SuperMiroPayloads({
    id: 101,
    trno: 'TR-101',
    approvalStatus: 'APPROVED',
    sapSupplierId: '12345',
    lines: [
      {
        seqno: 1,
        invoiceNo: 'INV-1',
        businessType: '03',
        issueDate: '2026-08-01',
        sellerName: 'Seller A',
        description: 'Hotel accommodation',
        currency: 'CNY',
        amount: '106.00',
        grossAmount: '120.00',
        taxAmount: 6,
        note: null,
        bookingCode: 'TAXI',
        bookingDescription: 'Taxi',
        hkont: '660001',
        kostl: 'CN100',
      },
      {
        seqno: 2,
        invoiceNo: 'INV-2',
        businessType: '03',
        amount: 212,
        grossAmount: 220,
        taxAmount: 12,
      },
    ],
  });

  assert.equal(payloads.length, 2);
  assert.deepEqual(payloads[0], {
    Code: '',
    Lifnr: '0000012345',
    Vatno: 'INV-1',
    Seqno: 'TR-101',
    IssueDate: '2026-08-01',
    SellerName: 'Seller A',
    BuyerName: '',
    Name: 'Hotel accommodation',
    Waers: 'CNY',
    UnitPrice: '106.00',
    Netwr: '106.00',
    Tax: '6.00',
    Note: '',
    bookingCode: 'TAXI - Taxi',
    Hkont: '660001',
    Kostl: 'CN100',
    SumTotal: '318.00',
    SumNetwr: '300.00',
    SumTax: '18.00',
    Taxrate: '',
    invoiceTranscationType: '03',
    TotalAmt: '120.00',
  });
  assert.equal(payloads[1].Vatno, 'INV-2');
  assert.equal(payloads[1].Seqno, 'TR-101');
  assert.equal(payloads[1].SellerName, '');
  assert.equal(payloads[1].Name, '');
  assert.equal(payloads[1].UnitPrice, '212.00');
  assert.equal(payloads[1].Netwr, '212.00');
  assert.equal(payloads[1].SumTotal, '318.00');
  assert.equal(payloads[0].TotalAmt, '120.00');
  assert.equal(payloads[1].TotalAmt, '220.00');
  assert.equal(typeof payloads[0].UnitPrice, 'string');
  assert.equal(typeof payloads[0].Tax, 'string');
  assert.equal(typeof payloads[0].Lifnr, 'string');
});

test('type 03 payload preserves SAP supplier ID as a ten-character string', () => {
  const [payload] = buildType03SuperMiroPayloads({
    id: 109,
    sapSupplierId: '0000012345',
    lines: [{ seqno: 1, invoiceNo: 'INV-SUPPLIER', businessType: '03', amount: 1, grossAmount: 1, taxAmount: 0 }],
  });

  assert.equal(payload.Lifnr, '0000012345');
  assert.equal(typeof payload.Lifnr, 'string');
});

test('type 03 payload rejects an SAP supplier ID longer than ten characters', () => {
  assert.throws(
    () =>
      buildType03SuperMiroPayloads({
        id: 110,
        sapSupplierId: '12345678901',
        lines: [{ seqno: 1, invoiceNo: 'INV-SUPPLIER-LONG', businessType: '03', amount: 1, grossAmount: 1, taxAmount: 0 }],
      }),
    /SAP Supplier ID must not exceed 10 characters/,
  );
});

test('type 03 payload rejects unsupported invoice business types', () => {
  assert.throws(
    () =>
      buildType03SuperMiroPayloads({
        id: 102,
        lines: [
          {
            seqno: 1,
            invoiceNo: 'INV-01',
            businessType: '01',
            amount: 100,
            grossAmount: 100,
            taxAmount: 6,
          },
        ],
      }),
    /unsupported business type 01/,
  );
});

test('type 03 payload sends booking code and localized description together', () => {
  const [payload] = buildType03SuperMiroPayloads({
    id: 108,
    lines: [
      {
        seqno: 1,
        invoiceNo: 'INV-BOOKING',
        businessType: '03',
        amount: 100,
        grossAmount: 100,
        taxAmount: 0,
        bookingCode: 'TAXI',
        bookingDescription: '出租车网约车',
      },
    ],
  });

  assert.equal(payload.bookingCode, 'TAXI - 出租车网约车');
});

test('type 03 payload requires numeric reimbursement and tax amounts', () => {
  assert.throws(
    () =>
      buildType03SuperMiroPayloads({
        id: 103,
        lines: [
          {
            seqno: 1,
            invoiceNo: 'INV-BAD',
            businessType: '03',
            amount: '',
            grossAmount: 100,
            taxAmount: 0,
          },
        ],
      }),
    /Reimbursement amount is required/,
  );
});

test('type 03 payload requires each invoice total amount', () => {
  assert.throws(
    () =>
      buildType03SuperMiroPayloads({
        id: 111,
        lines: [
          {
            seqno: 1,
            invoiceNo: 'INV-MISSING-TOTAL',
            businessType: '03',
            amount: 100,
            taxAmount: 6,
          },
        ],
      }),
    /Invoice total amount is required/,
  );
});

test('type 03 payload requires a positive integer reimbursement line number', () => {
  assert.throws(
    () =>
      buildType03SuperMiroPayloads({
        id: 104,
        lines: [
          {
            seqno: 0,
            invoiceNo: 'INV-BAD-SEQNO',
            businessType: '03',
            amount: 100,
            grossAmount: 100,
            taxAmount: 6,
          },
        ],
      }),
    /invalid reimbursement line number/,
  );
});

test('type 03 payload normalizes issue date to YYYY-MM-DD', () => {
  const [payload] = buildType03SuperMiroPayloads({
    id: 105,
    lines: [
      {
        seqno: 1,
        invoiceNo: 'INV-DATE',
        businessType: '03',
        issueDate: '2026-08-27T13:45:00.000Z',
        amount: 100,
        grossAmount: 100,
        taxAmount: 6,
      },
    ],
  });

  assert.equal(payload.IssueDate, '2026-08-27');
});

test('type 03 payload rejects non-YYYY-MM-DD issue dates', () => {
  assert.throws(
    () =>
      buildType03SuperMiroPayloads({
        id: 106,
        lines: [
          {
            seqno: 1,
            invoiceNo: 'INV-BAD-DATE',
            businessType: '03',
            issueDate: '08/27/2026',
            amount: 100,
            grossAmount: 100,
            taxAmount: 6,
          },
        ],
      }),
    /must use YYYY-MM-DD/,
  );
});

test('type 03 payload preserves the database calendar date without timezone shifting', () => {
  const [payload] = buildType03SuperMiroPayloads({
    id: 107,
    lines: [
      {
        seqno: 1,
        invoiceNo: 'INV-DATE-DB',
        businessType: '03',
        issueDate: '2025-02-03',
        amount: 100,
        grossAmount: 100,
        taxAmount: 6,
      },
    ],
  });

  assert.equal(payload.IssueDate, '2025-02-03');
});
