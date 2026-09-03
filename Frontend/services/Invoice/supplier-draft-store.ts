import type { supplierDraftApi } from './supplier-drafts';
import type { SupplierInvoiceDraft, SupplierBusinessType, EditableHeader, EditableLine } from './supplier-draft-model';

export interface DraftStoreState {
  drafts: SupplierInvoiceDraft[];
  busy: string[];
  dirty: string[];
  uploading: number;
  loading: boolean;
  error: string;
  savingAll: boolean;
}
export interface BatchSaveResult {
  total: number;
  saved: number;
  skipped: Array<{ filename: string; reason: string }>;
  failed: Array<{ filename: string; reason: string }>;
}
export class SupplierDraftStore {
  private state: DraftStoreState = { drafts: [], busy: [], dirty: [], uploading: 0, loading: false, error: '', savingAll: false };
  private listeners = new Set<() => void>();
  private pending = new Map<string, SupplierInvoiceDraft>();
  private writes = new Map<string, Promise<void>>();
  private conflicts = new Set<string>();
  private active = false;
  private refreshing = false;
  constructor(private readonly api: typeof supplierDraftApi) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<DraftStoreState>) {
    this.state = { ...this.state, ...patch, dirty: Array.from(new Set([...this.pending.keys(), ...this.writes.keys()])) };
    this.listeners.forEach((fn) => fn());
  }
  private upsert(row: SupplierInvoiceDraft) {
    const current = this.state.drafts.find((item) => item.id === row.id);
    if (current && current.version > row.version) return;
    this.emit({ drafts: this.state.drafts.some((item) => item.id === row.id)
      ? this.state.drafts.map((item) => item.id === row.id ? row : item) : [row, ...this.state.drafts] });
  }
  private row(id: string) {
    const row = this.state.drafts.find((item) => item.id === id);
    if (!row) throw new Error('草稿不存在');
    return row;
  }
  private report(error: unknown) { this.emit({ error: error instanceof Error ? error.message : '草稿同步失败，请重试' }); }
  activate() {
    if (this.active) return;
    this.active = true;
    this.emit({ loading: true });
    void this.refresh().finally(() => this.emit({ loading: false }));
  }
  async refresh() {
    if (!this.active || this.refreshing) return;
    this.refreshing = true;
    try {
      const rows = await this.api.list();
      const protectedIds = new Set([...this.pending.keys(), ...this.writes.keys(), ...this.state.busy]);
      const drafts = rows.map((row) => {
        const current = this.state.drafts.find((item) => item.id === row.id);
        return current && (protectedIds.has(row.id) || current.version > row.version) ? current : row;
      });
      for (const row of this.state.drafts) if (!drafts.some((item) => item.id === row.id)) drafts.push(row);
      this.emit({ drafts });
    } catch (error) { this.report(error); }
    finally { this.refreshing = false; }
  }
  tick() {
    if (!this.active) return;
    void this.refresh();
    for (const id of this.pending.keys()) if (!this.conflicts.has(id)) void this.flush(id).catch(() => undefined);
  }
  async upload(files: File[], businessType: SupplierBusinessType) {
    this.emit({ uploading: this.state.uploading + files.length, error: '' });
    await Promise.all(files.map(async (file) => {
      try { this.upsert(await this.api.upload(file, businessType)); }
      catch (error) { this.report(new Error(`${file.name}：${error instanceof Error ? error.message : '上传失败'}`)); }
      finally { this.emit({ uploading: this.state.uploading - 1 }); }
    }));
  }
  edit(id: string, patch: { header?: EditableHeader; lines?: EditableLine[] }) {
    const row = this.row(id);
    if (this.state.savingAll || ['saved','recognizing','queued'].includes(row.status) || this.state.busy.includes(id)) return;
    const next: SupplierInvoiceDraft = { ...row, ...patch, status: 'editing', error: undefined };
    this.pending.set(id, next);
    this.upsert(next);
    void this.flush(id).catch(() => undefined);
  }
  async flush(id: string): Promise<void> {
    if (this.conflicts.has(id)) throw new Error('草稿有版本冲突，请重新加载服务器草稿');
    const writing = this.writes.get(id);
    if (writing) return writing;
    if (!this.pending.has(id)) return;
    const run = async () => {
      while (this.pending.has(id)) {
        const attempted = { ...this.pending.get(id)!, version: this.row(id).version };
        this.pending.delete(id);
        try {
          const saved = await this.api.patch(attempted);
          this.upsert(this.pending.has(id) ? { ...this.row(id), version: saved.version } : saved);
          this.emit({ error: '' });
        } catch (error) {
          if (!this.pending.has(id)) this.pending.set(id, attempted);
          if ((error as { status?: number }).status === 409) this.conflicts.add(id);
          this.report(error);
          throw error;
        }
      }
    };
    const promise = run().finally(() => { this.writes.delete(id); this.emit({}); });
    this.writes.set(id, promise);
    this.emit({});
    return promise;
  }
  async action(id: string, action: 'save'|'retry') {
    await this.flush(id);
    if (this.state.busy.includes(id)) throw new Error('该发票正在处理');
    this.emit({ busy: [...this.state.busy, id], error: '' });
    try {
      const row = await this.api.action(this.row(id), action);
      this.upsert(row);
      return row;
    } catch (error) { this.report(error); throw error; }
    finally { this.emit({ busy: this.state.busy.filter((value) => value !== id) }); }
  }
  async saveAll(): Promise<BatchSaveResult> {
    if (this.state.savingAll) throw new Error('正在批量保存，请稍候');
    const targets = this.state.drafts.filter((row) => row.status !== 'saved').map((row) => row.id);
    const result: BatchSaveResult = { total: targets.length, saved: 0, skipped: [], failed: [] };
    this.emit({ savingAll: true, error: '' });
    try {
      for (const id of targets) {
        const row = this.row(id);
        if (['queued','recognizing','saved'].includes(row.status) || this.state.busy.includes(id)) {
          result.skipped.push({ filename: row.filename, reason: row.status === 'saved' ? '已保存' : '正在处理，请完成后再保存' });
          continue;
        }
        try {
          await this.action(id, 'save'); // Flush pending edits, then reuse the single-invoice transaction.
          result.saved += 1;
        } catch (error) {
          result.failed.push({ filename: row.filename, reason: error instanceof Error ? error.message : '保存失败' });
        }
      }
      return result;
    } finally { this.emit({ savingAll: false }); }
  }
  async reload(id: string) {
    await this.writes.get(id)?.catch(() => undefined);
    this.pending.delete(id); this.conflicts.delete(id);
    this.emit({ error: '' });
    await this.refresh();
  }
}
