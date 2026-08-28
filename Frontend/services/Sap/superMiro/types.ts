import type { SapQueryValue } from '../../SapOData';
import type { SuperMiroEInvoiceSapRecord } from './sapTypes';

export interface SuperMiroEInvoice {
  mandt: string;
  code: string;
  vatno: string;
  seqno: string;
  type: string;
  sellerName: string;
  sellerId: string;
  buyerName: string;
  buyerId: string;
  issueDate: string;
  name: string;
  spec: string;
  unitPrice: number | null;
  netwr: number | null;
  tax: number | null;
  totalAmt: number | null;
  fkimg: number | null;
  unit: string;
  gtiUnit: string;
  sumTax: number | null;
  sumNetwr: number | null;
  sumTotal: number | null;
  note: string;
  taxrate: string;
  taxcode: string;
  waers: string;
  pono: string;
  sencheck: string;
  diffline: string;
  msgtxt: string;
  gtstat: string;
  bukrs: string;
  lifnr: string;
  kostl: string;
  hkont: string;
  belnr: string;
  gjahr: string;
  usnam: string;
  tcode: string;
  belnrRe: string;
  gjahrRe: string;
  exmenge: number | null;
  extotal: number | null;
  remqty: number | null;
  ernam: string;
  aenam: string;
  source: string;
  batchno: string;
  url: string;
  matnr: string;
  bookingCode: string;
}

export interface ListSuperMiroEInvoicesInput {
  code?: string;
  vatno?: string;
  seqno?: string;
  bukrs?: string;
  lifnr?: string;
  pono?: string;
  belnr?: string;
  gjahr?: string;
  gtstat?: string;
  /** SAP field names used for OData $select, for example Vatno, Bukrs. */
  select?: Array<keyof SuperMiroEInvoiceSapRecord>;
  top?: number;
  skip?: number;
  count?: boolean;
}

/** SAP payload is intentionally not validated here; SAP owns field validation. */
export type CreateSuperMiroEInvoicePayload = Partial<SuperMiroEInvoiceSapRecord> &
  Record<string, unknown>;

export interface SuperMiroEInvoicesResult {
  items: SuperMiroEInvoice[];
  nextLink?: string;
  count?: number;
}

export type SuperMiroQueryValue = SapQueryValue;
