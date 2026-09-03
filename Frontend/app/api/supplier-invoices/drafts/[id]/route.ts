import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { supplierDraftRuntime } from '@/services/_server/supplier-drafts/entry';
import { draftError } from '@/services/_server/supplier-drafts/http';

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await context.params;
    return NextResponse.json(await supplierDraftRuntime().service.patch(auth, id, await request.json()));
  } catch (error) { return draftError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await context.params;
    const body = await request.json();
    return NextResponse.json(await supplierDraftRuntime().service.action(auth, id, body.action, body.version));
  } catch (error) { return draftError(error); }
}
