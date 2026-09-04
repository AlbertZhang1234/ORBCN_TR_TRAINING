import { invoiceAttachmentRuntime } from './invoice-attachments/entry';
import type { NotifyFinanceDependencies } from '../TravelReimbursement/notifyFinance';

export function financeNotificationDependencies(): NotifyFinanceDependencies {
  const attachments = invoiceAttachmentRuntime().service;
  return { readInvoiceFiles: (invoiceNos) => attachments.readMany(invoiceNos) };
}
