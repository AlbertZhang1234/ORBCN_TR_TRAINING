import {
  createBasicAuthProvider,
  createBearerAuthProvider,
} from '../SapOData/auth';
import { createSapODataClient } from '../SapOData/client';
import { createSapConfigurationError } from '../SapOData/errors';
import type { SapODataClientOptions, SapODataLogger } from '../SapOData/types';
import { createSapFetch } from './sapProxy';
import { createSapODataFileLogger } from './sapODataLogger';

type SapAuthMode = 'none' | 'basic' | 'bearer';

function readAuthMode(value: string | undefined): SapAuthMode {
  const mode = String(value ?? 'none').trim().toLowerCase();
  if (mode === 'basic' || mode === 'bearer' || mode === 'none') {
    return mode;
  }
  throw createSapConfigurationError(`Unsupported SAP_ODATA_AUTH_MODE: ${mode}`);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw createSapConfigurationError(`${name} is required`);
  }
  return value;
}

export interface SapODataDependencyOptions {
  fetch?: typeof fetch;
  logger?: SapODataLogger;
}

export function createSapODataClientFromEnv(
  options: SapODataDependencyOptions = {},
) {
  const clientOptions: SapODataClientOptions = {
    baseUrl: requiredEnv('SAP_ODATA_BASE_URL'),
    fetch: options.fetch ?? createSapFetch(),
    logger: options.logger ?? createSapODataFileLogger(),
    timeoutMs: Number(process.env.SAP_ODATA_TIMEOUT_MS ?? 15_000),
  };
  const mode = readAuthMode(process.env.SAP_ODATA_AUTH_MODE);

  if (mode === 'basic') {
    clientOptions.auth = createBasicAuthProvider(
      requiredEnv('SAP_ODATA_USERNAME'),
      requiredEnv('SAP_ODATA_PASSWORD'),
    );
  }

  if (mode === 'bearer') {
    const token = requiredEnv('SAP_ODATA_BEARER_TOKEN');
    clientOptions.auth = createBearerAuthProvider(async () => token);
  }

  return createSapODataClient(clientOptions);
}
