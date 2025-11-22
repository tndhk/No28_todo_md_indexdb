import pino from 'pino';

/**
 * Log levels configuration
 * - fatal: System is unusable
 * - error: Error conditions
 * - warn: Warning conditions
 * - info: Informational messages
 * - debug: Debug-level messages
 * - trace: Trace-level messages
 */
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Environment-based log level configuration
 */
const getLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  if (envLevel && ['fatal', 'error', 'warn', 'info', 'debug', 'trace'].includes(envLevel)) {
    return envLevel;
  }

  // Default levels based on environment
  switch (process.env.NODE_ENV) {
    case 'production':
      return 'info';
    case 'test':
      return 'error';
    default:
      return 'debug';
  }
};

/**
 * Check if we should use pretty printing (development only)
 */
const shouldUsePrettyPrint = (): boolean => {
  return process.env.NODE_ENV !== 'production' && process.env.LOG_FORMAT !== 'json';
};

/**
 * Base pino configuration
 */
const baseConfig: pino.LoggerOptions = {
  level: getLogLevel(),
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV || 'development',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      'password',
      'token',
      'secret',
      'authorization',
      'userId',
      'user.id',
      'user.email',
      '*.password',
      '*.token',
      '*.secret',
      '*.userId',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
};

/**
 * Create the logger instance
 */
const createLogger = (): pino.Logger => {
  if (shouldUsePrettyPrint()) {
    return pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(baseConfig);
};

/**
 * Main logger instance
 */
export const logger = createLogger();

/**
 * Create a child logger with additional context
 * Useful for adding request-specific or module-specific context
 */
export const createChildLogger = (bindings: pino.Bindings): pino.Logger => {
  return logger.child(bindings);
};

/**
 * API request logger - creates a child logger with request context
 */
export interface RequestContext {
  requestId?: string;
  method?: string;
  path?: string;
  userAgent?: string;
  ip?: string;
}

export const createRequestLogger = (context: RequestContext): pino.Logger => {
  return logger.child({
    ...context,
    component: 'api',
  });
};

/**
 * Performance measurement utilities
 */
export interface PerformanceMeasurement {
  operation: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

export const startPerformanceMeasurement = (
  operation: string,
  metadata?: Record<string, unknown>
): PerformanceMeasurement => {
  return {
    operation,
    startTime: performance.now(),
    metadata,
  };
};

export const endPerformanceMeasurement = (
  measurement: PerformanceMeasurement,
  log: pino.Logger = logger
): void => {
  const duration = performance.now() - measurement.startTime;
  log.info({
    type: 'performance',
    operation: measurement.operation,
    duration_ms: Math.round(duration * 100) / 100,
    ...measurement.metadata,
  }, `Operation ${measurement.operation} completed in ${duration.toFixed(2)}ms`);
};

/**
 * Structured error logging helper
 */
export interface ErrorContext {
  operation?: string;
  projectId?: string;
  taskId?: string;
  lineNumber?: number;
  [key: string]: unknown;
}

export const logError = (
  error: unknown,
  context: ErrorContext = {},
  log: pino.Logger = logger
): void => {
  const errorInfo = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    : { message: String(error) };

  log.error({
    ...context,
    error: errorInfo,
  }, errorInfo.message);
};

/**
 * API response logging helper
 */
export interface ResponseContext {
  statusCode: number;
  method: string;
  path: string;
  duration_ms?: number;
  [key: string]: unknown;
}

export const logApiResponse = (
  context: ResponseContext,
  log: pino.Logger = logger
): void => {
  const level = context.statusCode >= 500 ? 'error' :
                context.statusCode >= 400 ? 'warn' : 'info';

  log[level]({
    type: 'api_response',
    ...context,
  }, `${context.method} ${context.path} ${context.statusCode}`);
};

/**
 * Module-specific loggers for different parts of the application
 */
export const apiLogger = createChildLogger({ component: 'api' });
export const markdownLogger = createChildLogger({ component: 'markdown' });
export const securityLogger = createChildLogger({ component: 'security' });

export default logger;
