import { NextResponse } from 'next/server';
import { ServiceError } from '../../_core/error';

export function draftError(error: unknown) {
  const code = (error as { code?: string })?.code;
  const status = error instanceof ServiceError ? error.status ?? 500 : code === '23505' ? 409 : 500;
  const message = error instanceof ServiceError ? error.message : code === '23505'
    ? '发票号码已存在，请检查后重试' : '服务暂时不可用，数据未确认保存，请重试';
  return NextResponse.json({ message }, { status });
}
