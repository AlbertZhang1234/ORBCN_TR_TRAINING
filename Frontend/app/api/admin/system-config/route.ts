import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { systemConfigRuntime } from '@/services/_server/system-config/entry';
import { draftError } from '@/services/_server/supplier-drafts/http';

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json(await systemConfigRuntime().service.read(auth), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return draftError(error); }
}
export async function PUT(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json(await systemConfigRuntime().service.save(auth, await request.json()));
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
    return draftError(error);
  }
}
