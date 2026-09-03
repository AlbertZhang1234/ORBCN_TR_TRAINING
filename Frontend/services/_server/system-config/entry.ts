import { query } from '../../../lib/db';
import { SystemConfigRepository } from './repository';
import { SystemConfigService } from './service';
import { backendLogDirectory, createInvoiceLogger } from '../invoice-log';

export function systemConfigRuntime() {
  const repository = new SystemConfigRepository(query);
  const log = createInvoiceLogger(backendLogDirectory(process.cwd(), process.env.BACKEND_LOG_DIR));
  return { repository, service: new SystemConfigService(repository,
    (version) => log('system_config_saved', { config_version: version })) };
}
