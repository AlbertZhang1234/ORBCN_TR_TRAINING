import type { CreateSuperMiroEInvoicePayload } from './types';

export const SAP_POSTED_BOOKING_STATUS = '已回传SAP系统';

export interface SuperMiroReimbursementReference {
  id?: number | string;
  trno?: string;
  language?: 'zh' | 'en';
}

export interface SuperMiroType03LineSource {
  seqno: number;
  invoiceNo: string;
  businessType: string;
  issueDate?: string | null;
  sellerName?: string | null;
  description?: string | null;
  currency?: string | null;
  amount?: string | number | null;
  /** Invoice gross amount from otto_invoices.grossamount. */
  grossAmount?: string | number | null;
  taxAmount?: string | number | null;
  note?: string | null;
  bookingCode?: string | null;
  bookingDescription?: string | null;
  hkont?: string | null;
  kostl?: string | null;
}

export interface SuperMiroReimbursementSource {
  id: number | string;
  trno?: string | null;
  approvalStatus?: string | null;
  sapSupplierId?: string | null;
  lines: SuperMiroType03LineSource[];
}

export interface SuperMiroReimbursementPostingDependencies {
  loadReimbursement(
    reference: SuperMiroReimbursementReference,
  ): Promise<SuperMiroReimbursementSource>;
  postPayload(payload: CreateSuperMiroEInvoicePayload): Promise<unknown>;
  /** Persist the local state only after every SAP line has been accepted. */
  markReimbursementSapPosted(source: SuperMiroReimbursementSource): Promise<void>;
}

export interface SuperMiroReimbursementPostingItemResult {
  reimbursementId: string;
  reimbursementNo: string;
  success: boolean;
  totalLines: number;
  postedLines: number;
  message?: string;
}

export interface SuperMiroReimbursementPostingResult {
  success: boolean;
  totalReimbursements: number;
  successfulReimbursements: number;
  failedReimbursements: number;
  items: SuperMiroReimbursementPostingItemResult[];
}
