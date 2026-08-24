import { NextResponse } from 'next/server';
import { resetPassword } from '../../../../services/Auth/passwordReset';
import { ServiceError } from '../../../../services/_core/error';

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();
    
    if (!token) {
      return NextResponse.json({ message: 'Token is required' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ message: 'Password is required' }, { status: 400 });
    }

    await resetPassword(token, password);
    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    const message = error instanceof ServiceError ? error.message : 'Internal Server Error';
    const status = error instanceof ServiceError && (error.message.includes('expired') || error.message.includes('Invalid')) ? 400 : 500;
    return NextResponse.json({ message }, { status });
  }
}
