import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { supplierDraftRuntime } from '@/services/_server/supplier-drafts/entry';
import { draftError } from '@/services/_server/supplier-drafts/http';

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json(await supplierDraftRuntime().service.list(auth), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return draftError(error); }
}
export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ message: 'file is required' }, { status: 400 });
    const row = await supplierDraftRuntime().service.upload(auth, file, String(form.get('businesstype') ?? '01'));
    return NextResponse.json(row, { status: 201 });
  } catch (error) { return draftError(error); }
}
