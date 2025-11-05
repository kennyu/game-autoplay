/**
 * Custom error classes
 */

export class QAError extends Error {
  constructor(message: string, public metadata?: Record<string, unknown>) {
    super(message);
    this.name = 'QAError';
  }
}

export class BrowserError extends QAError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, metadata);
    this.name = 'BrowserError';
  }
}

export class ConfigError extends QAError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, metadata);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends QAError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, metadata);
    this.name = 'ValidationError';
  }
}

