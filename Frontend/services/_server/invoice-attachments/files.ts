import path from 'node:path';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { ServiceError } from '../../_core/error';

export type StorageKind = 'managed' | 'legacy-invoice' | 'legacy-supplier';

const formats = [
  { ext: 'pdf', mime: 'application/pdf', matches: (b: Buffer) => b.subarray(0, 5).toString() === '%PDF-' },
  { ext: 'png', mime: 'image/png', matches: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  { ext: 'jpg', mime: 'image/jpeg', matches: (b: Buffer) => b[0] === 255 && b[1] === 216 && b[2] === 255 },
  { ext: 'jpeg', mime: 'image/jpeg', matches: (b: Buffer) => b[0] === 255 && b[1] === 216 && b[2] === 255 },
  { ext: 'gif', mime: 'image/gif', matches: (b: Buffer) => ['GIF87a','GIF89a'].includes(b.subarray(0, 6).toString()) },
  { ext: 'bmp', mime: 'image/bmp', matches: (b: Buffer) => b.subarray(0, 2).toString() === 'BM' },
  { ext: 'webp', mime: 'image/webp', matches: (b: Buffer) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { ext: 'tiff', mime: 'image/tiff', matches: (b: Buffer) => ['II*\0','MM\0*'].includes(b.subarray(0, 4).toString()) },
] as const;

function safeLegacyName(value: string) {
  const name = path.basename(value);
  if (name !== value || name === '.' || name === '..' || !/^[a-zA-Z0-9._-]+$/.test(name))
    throw new ServiceError('Invalid legacy file key', { status: 400 });
  return name;
}

export class InvoiceAttachmentFiles {
  constructor(private readonly managedRoot: string, private readonly legacyInvoiceRoot: string,
    private readonly legacySupplierRoot: string) {}

  async store(id: string, bytes: Buffer) {
    const format = formats.find((candidate) => candidate.matches(bytes));
    if (!format) throw new ServiceError('仅支持 PDF 或常见图片格式的原始文件', { status: 400 });
    const storage_key = `${id}.${format.ext}`;
    await mkdir(this.managedRoot, { recursive: true });
    await writeFile(path.join(this.managedRoot, storage_key), bytes, { flag: 'wx' });
    return { storage_key, storage_kind: 'managed' as const, content_type: format.mime };
  }

  read(kind: StorageKind, key: string) {
    if (kind === 'managed') {
      if (!/^[a-f0-9-]{36}\.(pdf|png|jpg|jpeg|gif|bmp|webp|tiff)$/.test(key))
        throw new ServiceError('Invalid managed file key', { status: 400 });
      return readFile(path.join(this.managedRoot, key));
    }
    const root = kind === 'legacy-invoice' ? this.legacyInvoiceRoot : this.legacySupplierRoot;
    return readFile(path.join(root, safeLegacyName(key)));
  }

  async remove(kind: StorageKind, key: string) {
    if (kind !== 'managed') return;
    await unlink(path.join(this.managedRoot, safeLegacyName(key)));
  }

  async findLegacyInvoice(invoiceNo: string) {
    const base = invoiceNo.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const names = await readdir(this.legacyInvoiceRoot).catch(() => [] as string[]);
    const filename = names.find((name) => path.parse(name).name === base && formats.some((format) => name.toLowerCase().endsWith(`.${format.ext}`)));
    if (!filename) return null;
    const bytes = await this.read('legacy-invoice', filename);
    const format = formats.find((candidate) => candidate.matches(bytes));
    return format ? { bytes, storage_key: filename, storage_kind: 'legacy-invoice' as const,
      content_type: format.mime, filename, file_size: bytes.length } : null;
  }
}
