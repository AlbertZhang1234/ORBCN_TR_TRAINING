import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { invoiceAttachmentRuntime } from '@/services/_server/invoice-attachments/entry';
import { attachmentError } from '@/services/_server/invoice-attachments/http';

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const form = await request.formData();
    const file = form.get('file');
    const invoiceNo = String(form.get('invoiceNo') ?? '').trim();
    if (!(file instanceof File)) return NextResponse.json({ message: 'file is required' }, { status: 400 });
    if (!invoiceNo) return NextResponse.json({ message: 'invoiceNo is required' }, { status: 400 });
    const saved = await invoiceAttachmentRuntime().service.save(auth, invoiceNo, file);
    return NextResponse.json({ id: saved.id, filename: saved.original_filename }, { status: 201 });
  } catch (error) { return attachmentError(error); }
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const invoiceNo = new URL(request.url).searchParams.get('invoiceNo')?.trim();
    if (!invoiceNo) return NextResponse.json({ message: 'invoiceNo is required' }, { status: 400 });
    const source = await invoiceAttachmentRuntime().service.read(auth, invoiceNo);
    return new NextResponse(new Uint8Array(source.bytes), { headers: {
      'Content-Type': source.content_type,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(source.filename)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) { return attachmentError(error); }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const invoiceNo = new URL(request.url).searchParams.get('invoiceNo')?.trim();
    if (!invoiceNo) return NextResponse.json({ message: 'invoiceNo is required' }, { status: 400 });
    return NextResponse.json({ deleted: await invoiceAttachmentRuntime().service.deleteInvoice(auth, invoiceNo) });
  } catch (error) { return attachmentError(error); }
}
