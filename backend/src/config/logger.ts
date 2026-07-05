import pino, { Logger as PinoLogger } from 'pino';

import env from './env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMethod = (messageOrData: unknown, ...args: unknown[]) => void;

export interface AppLogger {
  child(bindings: Record<string, unknown>): AppLogger;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
}

const usePrettyLogs = env.LOG_PRETTY === true || (!env.IS_PRODUCTION && !env.IS_LAMBDA);

const baseLogger = pino({
  level: env.LOG_LEVEL || (env.IS_PRODUCTION ? 'info' : 'debug'),
  transport: usePrettyLogs
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname,module',
          messageFormat: '[{module}] {msg}',
          translateTime: 'HH:MM:ss',
        },
      }
    : undefined,
});

const toLogObject = (value: unknown): Record<string, unknown> => {
  if (value instanceof Error) {
    return { err: value };
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return { value };
};

const writeLog = (
  pinoLogger: PinoLogger,
  level: LogLevel,
  messageOrData: unknown,
  args: unknown[]
): void => {
  if (typeof messageOrData !== 'string') {
    pinoLogger[level](toLogObject(messageOrData));
    return;
  }

  if (args.length === 0) {
    pinoLogger[level](messageOrData);
    return;
  }

  if (args.length === 1) {
    pinoLogger[level](toLogObject(args[0]), messageOrData);
    return;
  }

  pinoLogger[level]({ values: args }, messageOrData);
};

const wrapLogger = (pinoLogger: PinoLogger): AppLogger => ({
  child(bindings: Record<string, unknown>): AppLogger {
    return wrapLogger(pinoLogger.child(bindings));
  },
  debug(messageOrData: unknown, ...args: unknown[]): void {
    writeLog(pinoLogger, 'debug', messageOrData, args);
  },
  info(messageOrData: unknown, ...args: unknown[]): void {
    writeLog(pinoLogger, 'info', messageOrData, args);
  },
  warn(messageOrData: unknown, ...args: unknown[]): void {
    writeLog(pinoLogger, 'warn', messageOrData, args);
  },
  error(messageOrData: unknown, ...args: unknown[]): void {
    writeLog(pinoLogger, 'error', messageOrData, args);
  },
});

export default wrapLogger(baseLogger);
