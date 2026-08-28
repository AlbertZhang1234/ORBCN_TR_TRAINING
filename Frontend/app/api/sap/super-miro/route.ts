import { NextResponse } from 'next/server';

import { ServiceError } from '@/services/_core/error';
import { requireApiAuth } from '@/services/_server/apiAuth';
import {
  createSuperMiroEInvoice,
  listSuperMiroEInvoices,
} from '@/services/Sap/superMiro';
import type {
  CreateSuperMiroEInvoicePayload,
  ListSuperMiroEInvoicesInput,
} from '@/services/Sap/superMiro';

export const runtime = 'nodejs';

function readText(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name)?.trim();
  return value || undefined;
}

function readInteger(params: URLSearchParams, name: string): number | undefined {
  const raw = readText(params, name);
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : undefined;
}

function readSelect(params: URLSearchParams): ListSuperMiroEInvoicesInput['select'] {
  const value = readText(params, 'select');
  return value
    ? (value.split(',').map((field) => field.trim()).filter(Boolean) as never)
    : undefined;
}

function parseInput(request: Request): ListSuperMiroEInvoicesInput {
  const params = new URL(request.url).searchParams;
  return {
    code: readText(params, 'code'),
    vatno: readText(params, 'vatno'),
    seqno: readText(params, 'seqno'),
    bukrs: readText(params, 'bukrs'),
    lifnr: readText(params, 'lifnr'),
    pono: readText(params, 'pono'),
    belnr: readText(params, 'belnr'),
    gjahr: readText(params, 'gjahr'),
    gtstat: readText(params, 'gtstat'),
    select: readSelect(params),
    top: readInteger(params, 'top'),
    skip: readInteger(params, 'skip'),
    count: readText(params, 'count') === 'true',
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const result = await listSuperMiroEInvoices(parseInput(request));
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const status = error instanceof ServiceError && error.status ? error.status : 502;
    const message = error instanceof Error ? error.message : 'SuperMiro SAP request failed';
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const payload = (await request.json()) as CreateSuperMiroEInvoicePayload;
    const result = await createSuperMiroEInvoice(payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const status = error instanceof ServiceError && error.status ? error.status : 502;
    const message = error instanceof Error ? error.message : 'SuperMiro SAP request failed';
    return NextResponse.json({ message }, { status });
  }
}
