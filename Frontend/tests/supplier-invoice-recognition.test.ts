import assert from 'node:assert/strict';
import test from 'node:test';
import { reconciliationWarnings, validateDraft, type SupplierInvoiceDraft } from '../app/pc/supplier-invoice-recognition/_components/model';
import { createSupplierInvoiceWithLines } from '../services/_server/supplierInvoiceRecognition';

function draft(): SupplierInvoiceDraft {
  return {
    id: 'draft-1', filename: 'invoice.pdf', status: 'editing', version: 1,
    header: {
      invoiceno: 'INV-1', invoicedate: '2026-09-02', supplier: 'Supplier', description: '',
      comment: '', bookingcode: '', businesstype: '01', currency: 'CNY',
      totalnetamount: 100, taxamount: 13, grossamount: 113,
    },
    lines: [{
      key: 'line-1', description: 'Item', spec_model: '', quantity: 1, unit_price: 100,
      amount_excl_tax: 100, tax_rate: '13%', amount_incl_tax: 113,
    }],
  };
}

test('a complete supplier draft is valid and reconciled', () => {
  const value = draft();
  assert.deepEqual(validateDraft(value), []);
  assert.deepEqual(reconciliationWarnings(value), []);
});

test('line/header differences are warnings instead of validation blockers', () => {
  const value = draft();
  value.lines[0].amount_incl_tax = 112;
  assert.deepEqual(validateDraft(value), []);
  assert.equal(reconciliationWarnings(value).length, 1);
});

test('server rejects reimbursement business type before persistence', async () => {
  const auth = {
    sessionId: 'session', userid: 'user', roleids: [],
    permissions: { isAdmin: false, isFinance: false, isProjectManager: false },
  };
  await assert.rejects(
    createSupplierInvoiceWithLines(
      { withTransaction: async () => { throw new Error('must not reach database'); } },
      auth, { invoiceno: 'INV-03', businesstype: '03' }, [{ description: 'Item' }],
    ),
    /must be 01 or 02/,
  );
});
