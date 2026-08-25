const LEVELS = ['debug', 'info', 'warn', 'error'];

function resolveLogLevel() {
  if (process.env.LOG_LEVEL) {
    const normalized = process.env.LOG_LEVEL.toLowerCase();
    if (LEVELS.includes(normalized)) {
      return normalized;
    }
  }

  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const activeLevel = resolveLogLevel();
const activeIndex = LEVELS.indexOf(activeLevel);

function shouldLog(level) {
  const levelIndex = LEVELS.indexOf(level);
  return levelIndex >= activeIndex;
}

function formatArgs(level, args) {
  const prefix = `[${level.toUpperCase()}]`;
  return [prefix, ...args];
}

const logger = {
  debug: (...args) => {
    if (shouldLog('debug')) {
      console.debug(...formatArgs('debug', args));
    }
  },
  info: (...args) => {
    if (shouldLog('info')) {
      console.info(...formatArgs('info', args));
    }
  },
  warn: (...args) => {
    if (shouldLog('warn')) {
      console.warn(...formatArgs('warn', args));
    }
  },
  error: (...args) => {
    if (shouldLog('error')) {
      console.error(...formatArgs('error', args));
    }
  }
};

module.exports = logger;
