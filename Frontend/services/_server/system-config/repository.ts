import type { RecognitionSettings, SystemConfigSnapshot } from '../../SystemConfig/model';
import { validateRecognitionSettings } from '../../SystemConfig/model';
import { ServiceError } from '../../_core/error';

function configurationError(error: unknown): never {
  if ((error as { code?: string })?.code === '42P01')
    throw new ServiceError('系统配置未初始化，请执行 create_system_config.sql / Apply the system configuration migration', { status: 503 });
  throw error;
}

export class SystemConfigRepository {
  constructor(private readonly query: (sql: string, params?: unknown[]) => Promise<Array<{ value?: unknown; version: number; updated_at: Date }>>) {}
  async read(): Promise<SystemConfigSnapshot> {
    try {
      const row = (await this.query('SELECT value, version, updated_at FROM otto_system_config WHERE key=$1', ['invoice_recognition']))[0];
      if (!row) throw new ServiceError('系统配置未初始化，请执行 create_system_config.sql', { status: 503 });
      return { values: validateRecognitionSettings(row.value), version: row.version, updatedAt: row.updated_at?.toISOString() ?? null };
    } catch (error) { return configurationError(error); }
  }
  async save(values: RecognitionSettings, version: number, userid: string): Promise<SystemConfigSnapshot> {
    try {
      const row = (await this.query(
        `UPDATE otto_system_config SET value=$1::jsonb, version=version+1, updated_by=$2, updated_at=now()
         WHERE key='invoice_recognition' AND version=$3 RETURNING version, updated_at`,
        [JSON.stringify(values), userid, version],
      ))[0];
      if (!row) throw new ServiceError('配置已被其他管理员修改，请重新加载 / Settings changed; reload before saving', { status: 409 });
      return { values, version: row.version, updatedAt: row.updated_at.toISOString() };
    } catch (error) { return configurationError(error); }
  }
}
