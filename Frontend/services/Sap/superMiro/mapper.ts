import type { SuperMiroEInvoiceSapRecord } from './sapTypes';
import type { SuperMiroEInvoice } from './types';

function toText(value: string | number | null | undefined): string {
  return String(value ?? '').trim();
}

function toDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapSuperMiroEInvoice(
  record: SuperMiroEInvoiceSapRecord,
): SuperMiroEInvoice {
  return {
    mandt: toText(record.Mandt),
    code: toText(record.Code),
    vatno: toText(record.Vatno),
    seqno: toText(record.Seqno),
    type: toText(record.Type),
    sellerName: toText(record.SellerName),
    sellerId: toText(record.SellerId),
    buyerName: toText(record.BuyerName),
    buyerId: toText(record.BuyerId),
    issueDate: toText(record.IssueDate),
    name: toText(record.Name),
    spec: toText(record.Spec),
    unitPrice: toDecimal(record.UnitPrice),
    netwr: toDecimal(record.Netwr),
    tax: toDecimal(record.Tax),
    totalAmt: toDecimal(record.TotalAmt),
    fkimg: toDecimal(record.Fkimg),
    unit: toText(record.Unit),
    gtiUnit: toText(record.GtiUnit),
    sumTax: toDecimal(record.SumTax),
    sumNetwr: toDecimal(record.SumNetwr),
    sumTotal: toDecimal(record.SumTotal),
    note: toText(record.Note),
    taxrate: toText(record.Taxrate),
    taxcode: toText(record.Taxcode),
    waers: toText(record.Waers),
    pono: toText(record.Pono),
    sencheck: toText(record.Sencheck),
    diffline: toText(record.Diffline),
    msgtxt: toText(record.Msgtxt),
    gtstat: toText(record.Gtstat),
    bukrs: toText(record.Bukrs),
    lifnr: toText(record.Lifnr),
    kostl: toText(record.Kostl),
    hkont: toText(record.Hkont),
    belnr: toText(record.Belnr),
    gjahr: toText(record.Gjahr),
    usnam: toText(record.Usnam),
    tcode: toText(record.Tcode),
    belnrRe: toText(record.BelnrRe),
    gjahrRe: toText(record.GjahrRe),
    exmenge: toDecimal(record.Exmenge),
    extotal: toDecimal(record.Extotal),
    remqty: toDecimal(record.Remqty),
    ernam: toText(record.Ernam),
    aenam: toText(record.Aenam),
    source: toText(record.Source),
    batchno: toText(record.Batchno),
    url: toText(record.Url),
    matnr: toText(record.Matnr),
    bookingCode: toText(record.bookingCode),
  };
}
