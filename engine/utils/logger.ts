const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/** Change this constant to control which messages appear in the console. */
export const LOG_LEVEL: number = LogLevel.DEBUG;

const prefixes: Record<number, string | string[]> = {
  [LogLevel.DEBUG]: '[Engine][DEBUG]',
  [LogLevel.INFO]:  '[Engine][INFO]',
  [LogLevel.WARN]:  '[Engine][WARN]',
  [LogLevel.ERROR]: '[Engine][ERROR]',
};

const consoleFns: Record<number, (...args: unknown[]) => void> = {
  [LogLevel.DEBUG]: console.log,
  [LogLevel.INFO]:  console.log,
  [LogLevel.WARN]:  console.warn,
  [LogLevel.ERROR]: console.error,
};

function log(level: number, ...args: unknown[]): void {
  if (level >= LOG_LEVEL) consoleFns[level](prefixes[level], ...args);
}

export const logger = {
  debug: (...args: unknown[]) => log(LogLevel.DEBUG, ...args),
  info:  (...args: unknown[]) => log(LogLevel.INFO,  ...args),
  warn:  (...args: unknown[]) => log(LogLevel.WARN,  ...args),
  error: (...args: unknown[]) => log(LogLevel.ERROR, ...args)
};
