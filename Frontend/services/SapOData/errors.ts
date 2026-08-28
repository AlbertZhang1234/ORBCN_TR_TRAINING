import { ServiceError, type ServiceErrorOptions } from '../_core/error';

export class SapODataError extends ServiceError {
  constructor(message: string, options: ServiceErrorOptions = {}) {
    super(message, options);
    this.name = 'SapODataError';
  }
}

export function createSapConfigurationError(message: string): SapODataError {
  return new SapODataError(message, { code: 'SAP_ODATA_CONFIGURATION_ERROR' });
}
