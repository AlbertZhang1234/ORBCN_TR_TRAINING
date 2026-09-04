import { NextResponse } from 'next/server';
import { ServiceError } from '../../_core/error';

export function attachmentError(error: unknown) {
  const status = error instanceof ServiceError ? error.status ?? 500 : 500;
  return NextResponse.json({ message: status === 500 ? 'Invoice attachment operation failed'
    : error instanceof Error ? error.message : 'Invoice attachment operation failed' }, { status });
}
