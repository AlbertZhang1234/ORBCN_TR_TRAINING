import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import InvoiceImportSummary from '../app/pc/invoices/_components/InvoiceImportSummary';
import { formatImportAmount, summarizeImportAmounts } from '../app/pc/invoices/_components/invoice-import-summary';
import { normalizeImportDrafts, type ImportInvoiceDraft } from '../app/pc/invoices/_components/shared';

function draft(id: string, currency = 'EUR', grossamount = 120): ImportInvoiceDraft {
  return {
    id,
    fileName: `${id}.pdf`,
    sourceFile: new File([], `${id}.pdf`),
    raw: { currency, amount_incl_tax: grossamount },
    payload: {
      invoiceno: id,
      userid: 'test-user',
      currency,
      originalcurrency: currency,
      totalnetamount: grossamount / 1.2,
      taxamount: grossamount - grossamount / 1.2,
      grossamount,
    },
  };
}

const translate = (_key: string, fallback: string) => fallback;

test('groups recognized non-skipped invoices by normalized original currency', () => {
  const changedTarget = draft('eur-2', ' eur ', 60);
  changedTarget.payload.currency = 'CNY';
  const rows = [draft('eur-1'), draft('cny', 'CNY', 240), changedTarget];

  assert.deepEqual(summarizeImportAmounts(rows), [
    { currency: 'CNY', count: 1, amounts: { totalnetamount: 200, taxamount: 40, grossamount: 240 } },
    { currency: 'EUR', count: 2, amounts: { totalnetamount: 150, taxamount: 30, grossamount: 180 } },
  ]);
  assert.equal(changedTarget.payload.currency, 'CNY');
});

test('excludes failed, skipped, and not-yet-recognized rows even if they have amounts', () => {
  const rows = [
    draft('success'),
    { ...draft('failed'), parseError: 'Recognition failed' },
    { ...draft('skipped'), skipReason: 'Invoice already exists' },
    { ...draft('pending'), raw: undefined },
  ];
  assert.equal(summarizeImportAmounts(rows)[0].count, 1);
  assert.equal(summarizeImportAmounts(rows)[0].amounts.grossamount, 120);
  assert.deepEqual(summarizeImportAmounts(rows.slice(1)), []);
  assert.deepEqual(summarizeImportAmounts([]), []);
});

test('honors existing duplicate and user validation without excluding blank descriptions', () => {
  const rows = normalizeImportDrafts([
    draft('success'), draft('exists'), draft('duplicate'), draft('duplicate'),
    { ...draft('missing-user'), payload: { ...draft('missing-user').payload, userid: '' } },
  ], new Set(['exists']), translate);
  assert.equal(summarizeImportAmounts(rows)[0].count, 1);
  assert.equal(summarizeImportAmounts(rows)[0].amounts.grossamount, 120);
});

test('does not present partial totals or invalid amounts as zero', () => {
  const incomplete = draft('incomplete');
  incomplete.payload.totalnetamount = undefined;
  incomplete.payload.taxamount = Number.NaN;
  const groups = summarizeImportAmounts([draft('complete'), incomplete]);
  assert.deepEqual(groups[0].amounts, { totalnetamount: undefined, taxamount: undefined, grossamount: 240 });
  incomplete.payload.grossamount = Number.POSITIVE_INFINITY;
  assert.equal(summarizeImportAmounts([incomplete])[0].amounts.grossamount, undefined);
  assert.equal(formatImportAmount(undefined, 'EUR', 'en'), '—');
});

test('keeps zero and negative amounts and formats fractional totals without floating point artifacts', () => {
  const groups = summarizeImportAmounts([
    draft('fraction-1', 'EUR', 0.1), draft('fraction-2', 'EUR', 0.2), draft('zero', 'EUR', 0),
  ]);
  assert.equal(groups[0].count, 3);
  assert.equal(formatImportAmount(groups[0].amounts.grossamount, 'EUR', 'zh'), '0.30');
  assert.equal(summarizeImportAmounts([draft('credit', 'EUR', -120)])[0].amounts.grossamount, -120);
  assert.equal(formatImportAmount(1234, 'JPY', 'zh'), '1,234');
  assert.equal(formatImportAmount(1.234, 'KWD', 'en'), '1.234');
});

test('falls back to payload currency and isolates unknown currencies', () => {
  const fallback = draft('fallback', 'USD');
  fallback.payload.originalcurrency = '';
  const groups = summarizeImportAmounts([fallback, draft('unknown', '')]);
  assert.equal(groups.find((group) => group.currency === 'USD')?.count, 1);
  assert.equal(groups.find((group) => group.currency === '')?.count, 1);
  assert.equal(formatImportAmount(1234.5, '', 'en'), '1,234.50');
});

test('recalculates totals from edited amounts and skip status', () => {
  const row = draft('editable');
  assert.equal(summarizeImportAmounts([row])[0].amounts.grossamount, 120);
  const edited = { ...row, payload: { ...row.payload, grossamount: 150 } };
  assert.equal(summarizeImportAmounts([edited])[0].amounts.grossamount, 150);
  assert.deepEqual(summarizeImportAmounts([{ ...edited, skipReason: 'Skipped' }]), []);
});

test('renders grouped totals, the scope note, and no summary before upload', () => {
  const render = (rows: ImportInvoiceDraft[]) => renderToStaticMarkup(createElement(InvoiceImportSummary, { rows, t: translate, lang: 'en' }));
  assert.equal(render([]), '');
  const markup = render([draft('eur'), draft('cny', 'CNY', 240)]);
  assert.match(markup, /Recognized total · 2 invoice\(s\)/);
  assert.match(markup, /EUR · 1 invoice\(s\)/);
  assert.match(markup, /CNY · 1 invoice\(s\)/);
  assert.match(markup, /Gross Amount: 120\.00/);
  assert.match(markup, /Gross Amount: 240\.00/);
  assert.match(markup, /failed and skipped invoices excluded/);
  assert.match(render([{ ...draft('failed'), parseError: 'Failed' }]), /No successfully recognized, non-skipped invoices/);
});

test('renders unknown currency and incomplete totals with explanatory labels', () => {
  const row = draft('unknown', '');
  row.payload.taxamount = undefined;
  const markup = renderToStaticMarkup(createElement(InvoiceImportSummary, { rows: [row], t: translate, lang: 'en' }));
  assert.match(markup, /Unknown currency/);
  assert.match(markup, /Tax Amount: —/);
  assert.match(markup, /an amount is missing or invalid/);
});
