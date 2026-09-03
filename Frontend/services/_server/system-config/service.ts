import type { RequestAuthContext } from '../requestAuth';
import type { SystemConfigRepository } from './repository';
import { validateRecognitionSettings } from '../../SystemConfig/model';
import { ServiceError } from '../../_core/error';

export class SystemConfigService {
  constructor(private readonly repo: SystemConfigRepository,
    private readonly audit: (version: number) => Promise<void> = async () => undefined) {}
  read(auth: RequestAuthContext) { this.requireAdmin(auth); return this.repo.read(); }
  async publicSettings() {
    const { values } = await this.repo.read();
    return { upload_concurrency: values.upload_concurrency, interactive_concurrency: values.interactive_concurrency };
  }
  save(auth: RequestAuthContext, input: { values?: unknown; version?: unknown }) {
    this.requireAdmin(auth);
    if (!input || !Number.isInteger(input.version) || Number(input.version) < 1)
      throw new ServiceError('Missing configuration version', { status: 400 });
    let values;
    try { values = validateRecognitionSettings(input.values); }
    catch (error) { throw new ServiceError((error as Error).message, { status: 400 }); }
    return this.repo.save(values, Number(input.version), auth.userid).then(async (snapshot) => {
      await this.audit(snapshot.version);
      return snapshot;
    });
  }
  private requireAdmin(auth: RequestAuthContext) {
    if (!auth.permissions.isAdmin) throw new ServiceError('Administrator access required', { status: 403 });
  }
}
