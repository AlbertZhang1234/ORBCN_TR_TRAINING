export interface ServiceErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
  requestId?: string;
  rawText?: string | null;
}

export class ServiceError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly requestId?: string;
  readonly rawText?: string | null;

  constructor(message: string, options: ServiceErrorOptions = {}) {
    super(message);
    this.name = 'ServiceError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
    this.rawText = options.rawText;
  }
}
