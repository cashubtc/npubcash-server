/**
 * Minimal logging interface used by the SDK.
 *
 * Provide your own implementation or use {@link ConsoleLogger}.
 */
export interface Logger {
  /** Log informational events. */
  info(message: string, ...meta: any[]): void;
  /** Log warnings about unexpected but recoverable situations. */
  warn(message: string, ...meta: any[]): void;
  /** Log errors and failures. */
  error(message: string, ...meta: any[]): void;
  /** Log verbose debugging details. */
  debug(message: string, ...meta: any[]): void;
  // Add other levels as needed if you want more granularity (e.g., trace, verbose)
}

/**
 * Logger that writes to the browser/Node console with SDK‑scoped prefixes.
 */
export class ConsoleLogger implements Logger {
  info(message: string, ...meta: any[]): void {
    console.info(`[SDK Info] ${message}`, ...meta);
  }

  warn(message: string, ...meta: any[]): void {
    console.warn(`[SDK Warning] ${message}`, ...meta);
  }

  error(message: string, ...meta: any[]): void {
    console.error(`[SDK Error] ${message}`, ...meta);
  }

  debug(message: string, ...meta: any[]): void {
    console.debug(`[SDK Debug] ${message}`, ...meta);
  }
}

/**
 * No‑op logger that discards all messages.
 */
export class NullLogger implements Logger {
  info(_message: string, ..._meta: any[]): void {}
  warn(_message: string, ..._meta: any[]): void {}
  error(_message: string, ..._meta: any[]): void {}
  debug(_message: string, ..._meta: any[]): void {}
}
