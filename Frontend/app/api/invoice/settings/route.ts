import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { systemConfigRuntime } from '@/services/_server/system-config/entry';
import { draftError } from '@/services/_server/supplier-drafts/http';

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json(await systemConfigRuntime().service.publicSettings(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return draftError(error); }
}
