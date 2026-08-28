import assert from 'node:assert/strict';
import { test } from 'node:test';

import { postType03ReimbursementsToSuperMiro } from '../services/Sap/superMiro/reimbursementPosting.ts';
import type { CreateSuperMiroEInvoicePayload } from '../services/Sap/superMiro/types.ts';
import { normalizeWorkflowStatus } from '../services/_core/locks.ts';

function approvedSource() {
  return {
    id: 201,
    trno: 'TR-201',
    approvalStatus: 'APPROVED',
    sapSupplierId: '12345',
    lines: [
      { seqno: 1, invoiceNo: 'INV-1', businessType: '03', amount: 100, grossAmount: 106, taxAmount: 6 },
      { seqno: 2, invoiceNo: 'INV-2', businessType: '03', amount: 200, grossAmount: 212, taxAmount: 12 },
    ],
  };
}

test('SAP-posted booking status is treated as completed', () => {
  assert.equal(normalizeWorkflowStatus('已回传SAP系统'), 'BOOKED');
});

test('posting service sends one SAP request per reimbursement invoice line', async () => {
  const posted: CreateSuperMiroEInvoicePayload[] = [];
  const statusUpdates: string[] = [];
  const result = await postType03ReimbursementsToSuperMiro(
    [{ id: 201 }],
    {
      async loadReimbursement() {
        return approvedSource();
      },
      async postPayload(payload) {
        posted.push(payload);
      },
      async markReimbursementSapPosted(source) {
        statusUpdates.push(String(source.id));
      },
    },
  );

  assert.equal(result.success, true);
  assert.equal(result.successfulReimbursements, 1);
  assert.equal(result.items[0].postedLines, 2);
  assert.deepEqual(posted.map((payload) => payload.Seqno), ['TR-201', 'TR-201']);
  assert.deepEqual(posted.map((payload) => payload.Vatno), ['INV-1', 'INV-2']);
  assert.deepEqual(posted.map((payload) => payload.Lifnr), ['0000012345', '0000012345']);
  assert.equal(typeof posted[0].Lifnr, 'string');
  assert.deepEqual(statusUpdates, ['201']);
});

test('posting service reports partial line success without posting later lines', async () => {
  let calls = 0;
  let statusUpdates = 0;
  const result = await postType03ReimbursementsToSuperMiro(
    [{ id: 201 }],
    {
      async loadReimbursement() {
        return approvedSource();
      },
      async postPayload() {
        calls += 1;
        if (calls === 2) {
          throw new Error('SAP rejected line 2');
        }
      },
      async markReimbursementSapPosted() {
        statusUpdates += 1;
      },
    },
  );

  assert.equal(result.success, false);
  assert.equal(result.failedReimbursements, 1);
  assert.equal(result.items[0].postedLines, 1);
  assert.equal(result.items[0].totalLines, 2);
  assert.match(result.items[0].message ?? '', /SAP rejected line 2/);
  assert.equal(statusUpdates, 0);
});

test('posting service reports status update failure after SAP lines succeed', async () => {
  const result = await postType03ReimbursementsToSuperMiro(
    [{ id: 201 }],
    {
      async loadReimbursement() {
        return approvedSource();
      },
      async postPayload() {},
      async markReimbursementSapPosted() {
        throw new Error('local status update failed');
      },
    },
  );

  assert.equal(result.success, false);
  assert.equal(result.items[0].postedLines, 2);
  assert.match(result.items[0].message ?? '', /local status update failed/);
});

test('posting service rejects reimbursements that are not approved', async () => {
  const result = await postType03ReimbursementsToSuperMiro(
    [{ id: 202 }],
    {
      async loadReimbursement() {
        return { ...approvedSource(), id: 202, approvalStatus: 'Wait for Approval' };
      },
      async postPayload() {
        throw new Error('must not be called');
      },
      async markReimbursementSapPosted() {
        throw new Error('must not be called');
      },
    },
  );

  assert.equal(result.success, false);
  assert.equal(result.items[0].postedLines, 0);
  assert.match(result.items[0].message ?? '', /must be approved/);
});
