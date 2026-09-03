import { NextResponse } from 'next/server';
import { ServiceError } from '@/services/_core/error';
import { requireApiAuth } from '@/services/_server/apiAuth';
import {
  createSupplierInvoiceWithLines,
  type SupplierInvoiceHeaderInput,
} from '@/services/_server/supplierInvoiceRecognition';
import type { RecognizedInvoiceLineInput } from '@/services/_server/invoiceLines';
import { withTransaction } from '@/lib/db';

interface RequestBody {
  header?: SupplierInvoiceHeaderInput;
  lineItems?: RecognizedInvoiceLineInput[];
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const body = (await request.json()) as RequestBody;
    const row = await createSupplierInvoiceWithLines(
      { withTransaction }, auth, body.header ?? {}, body.lineItems ?? [],
    );
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const status = error instanceof ServiceError && error.status ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Failed to save supplier invoice';
    return NextResponse.json({ message }, { status });
  }
}
