type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minimumLevel: Level = process.env.LOG_LEVEL === 'silent' ? 'error' : 'debug';

function emit(level: Level, message: string, meta?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel]) return;
  const line = { level, time: new Date().toISOString(), message, ...(meta !== undefined ? { meta } : {}) };
  const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  writer(JSON.stringify(line));
}

export const logger = {
  debug: (message: string, meta?: unknown) => emit('debug', message, meta),
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  error: (message: string, meta?: unknown) => emit('error', message, meta),
};
