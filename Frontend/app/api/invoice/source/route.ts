import { NextResponse } from 'next/server';
import path from 'path';
import { mkdir, writeFile, readdir, readFile } from 'fs/promises';
import { query, queryOne } from '@/lib/db';
import { requireApiAuth } from '@/services/_server/apiAuth';
import type { RequestAuthContext } from '@/services/_server/requestAuth';
import { sameUser } from '@/services/TravelReimbursement/access';

interface InvoiceAccessRow {
  invoiceno?: string;
  userid?: string;
  travelid?: string;
  projectmanager?: string;
}

const EXTENSIONS_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/webp': '.webp',
  'image/tiff': '.tiff',
};

function sanitizeFileBaseName(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveExtension(fileName: string, mimeType: string): string {
  const ext = path.extname(fileName || '').trim();
  if (ext) {
    return ext;
  }
  return EXTENSIONS_BY_MIME[mimeType] ?? '';
}

async function loadInvoiceAccessRow(invoiceNo: string): Promise<InvoiceAccessRow | null> {
  return queryOne<InvoiceAccessRow>(
    `
    SELECT
      i.invoiceno,
      i.userid,
      i.travelid,
      p.projectmanager
    FROM "otto_invoices" i
    LEFT JOIN "otto_travelentry" te ON te.travelid = i.travelid
    LEFT JOIN "otto_project" p ON p.projectid = te.projectid
    WHERE i.invoiceno = $1
    LIMIT 1
    `,
    [invoiceNo],
  );
}

function canAccessInvoiceFile(
  auth: RequestAuthContext,
  row: InvoiceAccessRow | null,
): boolean {
  if (!row) {
    return true;
  }

  if (auth.permissions.isAdmin || auth.permissions.isFinance) {
    return true;
  }

  if (sameUser(row.userid, auth.userid)) {
    return true;
  }

  if (auth.permissions.isProjectManager && sameUser(row.projectmanager, auth.userid)) {
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const invoiceNo = String(formData.get('invoiceNo') ?? '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'file is required' }, { status: 400 });
    }
    if (!invoiceNo) {
      return NextResponse.json({ message: 'invoiceNo is required' }, { status: 400 });
    }

    const safeInvoiceNo = sanitizeFileBaseName(invoiceNo);
    if (!safeInvoiceNo) {
      return NextResponse.json({ message: 'invoiceNo is invalid' }, { status: 400 });
    }

    const invoiceRow = await loadInvoiceAccessRow(invoiceNo);
    if (!canAccessInvoiceFile(auth, invoiceRow)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const extension = resolveExtension(file.name || '', file.type || '');
    const targetName = `${safeInvoiceNo}${extension}`;
    const dataDir = path.join(process.cwd(), 'data');
    await mkdir(dataDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    await writeFile(path.join(dataDir, targetName), Buffer.from(arrayBuffer));

    return NextResponse.json({ file: targetName, status: 200 }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save source file failed';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const invoiceNo = searchParams.get('invoiceNo');

    if (!invoiceNo) {
      return NextResponse.json({ message: 'invoiceNo is required' }, { status: 400 });
    }

    const safeInvoiceNo = sanitizeFileBaseName(invoiceNo);
    if (!safeInvoiceNo) {
      return NextResponse.json({ message: 'invoiceNo is invalid' }, { status: 400 });
    }

    const invoiceRow = await loadInvoiceAccessRow(invoiceNo);
    if (!invoiceRow) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }
    if (!canAccessInvoiceFile(auth, invoiceRow)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    let dataDir = path.join(process.cwd(), 'data');
    
    // We need to find the file because we don't know the extension
    let files: string[] = [];
    try {
      files = await readdir(dataDir);
    } catch (err) {
      // Fallback: check if 'Frontend/data' exists if 'data' doesn't, assuming root execution
      try {
        dataDir = path.join(process.cwd(), 'Frontend', 'data');
        files = await readdir(dataDir);
      } catch {
        // Directory might not exist
        return NextResponse.json({ message: 'File not found' }, { status: 404 });
      }
    }

    const targetFile = files.find(f => f.startsWith(`${safeInvoiceNo}.`));

    if (!targetFile) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }

    const filePath = path.join(dataDir, targetFile);
    const fileBuffer = await readFile(filePath);

    // Determine content type
    const ext = path.extname(targetFile).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${targetFile}"`,
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Get source file failed';
    return NextResponse.json({ message }, { status: 500 });
  }
}
