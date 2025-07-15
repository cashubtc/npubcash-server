export interface Logger {
  info(message: string, ...meta: any[]): void;
  warn(message: string, ...meta: any[]): void;
  error(message: string, ...meta: any[]): void;
  debug(message: string, ...meta: any[]): void;
  // Add other levels as needed if you want more granularity (e.g., trace, verbose)
}

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

export class NullLogger implements Logger {
  info(_message: string, ..._meta: any[]): void {}
  warn(_message: string, ..._meta: any[]): void {}
  error(_message: string, ..._meta: any[]): void {}
  debug(_message: string, ..._meta: any[]): void {}
}
