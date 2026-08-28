import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/services/_server/apiAuth';
import { listBookingRules } from '@/services/Invoice/booking-rules';

function getParseEndpoint(): string {
  return (
    process.env.INVOICE_PARSE_ENDPOINT ??
    process.env.NEXT_PUBLIC_INVOICE_PARSE_ENDPOINT ??
    'http://127.0.0.1:8201/api/v1/invoice/classify'
  );
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'file is required' }, { status: 400 });
    }

    const upstreamFormData = new FormData();
    upstreamFormData.append('file', file, file.name || 'invoice.pdf');
    const bookingRules = await listBookingRules();
    if (bookingRules.length === 0) {
      return NextResponse.json({ message: 'No active booking rules configured' }, { status: 503 });
    }
    upstreamFormData.append('booking_rules', JSON.stringify(bookingRules));

    const response = await fetch(getParseEndpoint(), {
      method: 'POST',
      body: upstreamFormData,
    });

    let payload: unknown;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          message: 'Invoice parse failed',
          details: payload,
          status: response.status,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invoice parse request failed';
    return NextResponse.json({ message }, { status: 500 });
  }
}
