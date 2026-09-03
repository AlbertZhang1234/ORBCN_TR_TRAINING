import { NextResponse } from 'next/server';
import { ServiceError } from '@/services/_core/error';
import { requireApiAuth } from '@/services/_server/apiAuth';
import {
  replaceRecognizedInvoiceLines,
  type RecognizedInvoiceLineInput,
} from '@/services/_server/invoiceLines';

interface SaveInvoiceLinesRequest {
  invoiceno?: string;
  lineItems?: RecognizedInvoiceLineInput[];
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json()) as SaveInvoiceLinesRequest;
    const rows = await replaceRecognizedInvoiceLines(
      auth,
      String(body.invoiceno ?? ''),
      body.lineItems ?? [],
    );
    return NextResponse.json(rows);
  } catch (error) {
    const status = error instanceof ServiceError && error.status ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Failed to save invoice lines';
    return NextResponse.json({ message }, { status });
  }
}
