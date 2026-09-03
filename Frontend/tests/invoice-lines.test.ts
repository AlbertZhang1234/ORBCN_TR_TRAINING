import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRecognizedInvoiceLines } from '../services/_server/invoiceLines';

test('normalizes every recognized invoice line without dropping extracted fields', () => {
  const lines = normalizeRecognizedInvoiceLines([
    {
      line_no: 2,
      description: ' Product A ',
      spec_model: ' X-1 ',
      unit_price: 12.5,
      quantity: 2,
      amount_excl_tax: 25,
      tax_rate: '13%',
      amount_incl_tax: 28.25,
    },
    {
      line_no: 2,
      description: 'Freight',
      unit_price: null,
      quantity: null,
      amount_excl_tax: 5,
      tax_rate: '免税',
      amount_incl_tax: 5,
    },
  ]);

  assert.deepEqual(lines, [
    {
      seqno: 2,
      description: 'Product A',
      spec_model: 'X-1',
      unit_price: 12.5,
      quantity: 2,
      amount_excl_tax: 25,
      tax_rate: '13%',
      amount_incl_tax: 28.25,
    },
    {
      seqno: 3,
      description: 'Freight',
      spec_model: null,
      unit_price: null,
      quantity: null,
      amount_excl_tax: 5,
      tax_rate: '免税',
      amount_incl_tax: 5,
    },
  ]);
});
