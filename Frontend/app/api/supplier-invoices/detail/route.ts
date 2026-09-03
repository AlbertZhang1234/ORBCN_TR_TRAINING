import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { draftError } from '@/services/_server/supplier-drafts/http';
import { supplierInvoiceEditService } from '@/services/_server/supplier-invoices/entry';

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const invoiceNo = new URL(request.url).searchParams.get('invoiceNo') ?? '';
    return NextResponse.json(await supplierInvoiceEditService().load(auth, invoiceNo));
  } catch (error) { return draftError(error); }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const invoiceNo = new URL(request.url).searchParams.get('invoiceNo') ?? '';
    return NextResponse.json(await supplierInvoiceEditService().save(auth, invoiceNo, await request.json()));
  } catch (error) { return draftError(error); }
}
