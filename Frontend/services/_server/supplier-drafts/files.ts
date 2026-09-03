import path from 'node:path';
import { mkdir, readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { ServiceError } from '../../_core/error';

export class SupplierDraftFiles {
  constructor(private readonly root: string, private readonly legacyRoot: string) {}
  private location(key: string) {
    if (!/^[a-f0-9-]{36}\.(pdf|png|jpg)$/.test(key)) throw new ServiceError('Invalid file key', { status: 400 });
    return path.join(this.root, key);
  }
  async store(id: string, bytes: Buffer) {
    const format = bytes.subarray(0, 5).toString() === '%PDF-' ? ['pdf', 'application/pdf']
      : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? ['png', 'image/png']
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? ['jpg', 'image/jpeg'] : null;
    if (!format) throw new ServiceError('仅支持 PDF、PNG、JPEG 原始文件', { status: 400 });
    const key = `${id}.${format[0]}`;
    await mkdir(this.root, { recursive: true });
    await writeFile(this.location(key), bytes, { flag: 'wx' });
    return { storage_key: key, content_type: format[1] };
  }
  read(key: string) { return readFile(this.location(key)); }
  remove(key: string) { return unlink(this.location(key)); }
  async readLegacy(invoiceNo: string) {
    const safe = invoiceNo.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const names = await readdir(this.legacyRoot).catch(() => [] as string[]);
    const filename = names.find((name) => ['pdf','png','jpg','jpeg'].some((ext) => name === `${safe}.${ext}`));
    if (!filename) throw new ServiceError('原始文件不存在', { status: 404 });
    const content_type = filename.endsWith('.pdf') ? 'application/pdf' : filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return { bytes: await readFile(path.join(this.legacyRoot, filename)), content_type, filename };
  }
}
