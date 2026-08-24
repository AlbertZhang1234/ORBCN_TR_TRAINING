import { NextResponse } from 'next/server';

import {
  loadRequestAuthContext,
  type RequestAuthContext,
} from './requestAuth';
import { ServiceError } from '../_core/error';

export async function requireApiAuth(
  request: Request,
): Promise<RequestAuthContext | NextResponse> {
  try {
    return await loadRequestAuthContext(request);
  } catch (error) {
    const status = error instanceof ServiceError && error.status ? error.status : 401;
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ message }, { status });
  }
}
