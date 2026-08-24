import { NextResponse } from 'next/server';
import { requestPasswordReset } from '../../../../services/Auth/passwordReset';
import { ServiceError } from '../../../../services/_core/error';

export async function POST(request: Request) {
  try {
    const { account } = await request.json();
    if (!account) {
      return NextResponse.json({ message: 'Account is required' }, { status: 400 });
    }

    const result = await requestPasswordReset(account);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Forgot Password Error:', error);
    const message = error instanceof ServiceError ? error.message : 'Internal Server Error';
    const status = error instanceof ServiceError && error.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ message }, { status });
  }
}
