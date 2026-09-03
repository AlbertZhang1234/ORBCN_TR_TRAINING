import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { createInvoiceRecognitionClient } from '@/services/_server/invoiceRecognitionClient';
import { ServiceError } from '@/services/_core/error';

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ message: 'file is required' }, { status: 400 });
    return NextResponse.json(await createInvoiceRecognitionClient()(file));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Invoice parse failed' },
      { status: error instanceof ServiceError ? error.status ?? 500 : 500 });
  }
}
