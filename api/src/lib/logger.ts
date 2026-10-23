import { pino, stdSerializers, type DestinationStream, type Logger, type LoggerOptions } from 'pino';

/**
 * Anything that could hold food text, photos, AI analysis content or credentials.
 * Redacted by path so that a careless `log.info({ body })` still can't leak content.
 * Kept in sync with test/logger.test.ts.
 */
export const REDACT_PATHS = [
  'body',
  '*.body',
  'text',
  '*.text',
  'photo',
  '*.photo',
  'image',
  '*.image',
  'buffer',
  '*.buffer',
  'analysis',
  '*.analysis',
  'items',
  '*.items',
  'ingredients',
  '*.ingredients',
  'mealName',
  '*.mealName',
  'reasoning',
  '*.reasoning',
  'conditions',
  '*.conditions',
  'details',
  '*.details',
  // Bellie's summaries: what the app sends (meal names, symptoms, tags) and what comes back.
  'meals',
  '*.meals',
  'symptoms',
  '*.symptoms',
  'tags',
  '*.tags',
  'bellieLine',
  '*.bellieLine',
  'summary',
  '*.summary',
  'tips',
  '*.tips',
  'input',
  '*.input',
  'output',
  '*.output',
  'token',
  '*.token',
  'headers.authorization',
  '*.headers.authorization',
  'headers.cookie',
  '*.headers.cookie',
];

const ERROR_REPORTING_TYPE =
  'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';

/** Maps pino levels to Cloud Logging severities. */
const SEVERITY: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

export function createLogger(
  options: { level?: string; pretty?: boolean } = {},
  destination?: DestinationStream,
): Logger {
  const config: LoggerOptions = {
    level: options.level ?? 'info',
    messageKey: 'message',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    formatters: {
      level: (label) => ({ severity: SEVERITY[label] ?? 'DEFAULT' }),
      log: (object) => {
        // Errors at error level and above are picked up by Cloud Error Reporting.
        const err = object.err as { stack?: string } | undefined;
        return err?.stack ? { ...object, '@type': ERROR_REPORTING_TYPE, stack_trace: err.stack } : object;
      },
    },
    serializers: { err: stdSerializers.err },
  };

  if (options.pretty && !destination) {
    return pino({ ...config, transport: { target: 'pino-pretty', options: { messageKey: 'message' } } });
  }
  return destination ? pino(config, destination) : pino(config);
}
