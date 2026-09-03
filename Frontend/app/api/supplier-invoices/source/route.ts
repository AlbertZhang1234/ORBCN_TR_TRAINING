import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { supplierDraftRuntime } from '@/services/_server/supplier-drafts/entry';
import { draftError } from '@/services/_server/supplier-drafts/http';

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const params = new URL(request.url).searchParams;
    const source = await supplierDraftRuntime().source.read(auth, params.get('draftId'), params.get('invoiceNo'));
    return new NextResponse(new Uint8Array(source.bytes), { headers: {
      'Content-Type': source.content_type,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(source.filename)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) { return draftError(error); }
}
