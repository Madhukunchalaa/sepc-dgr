// shared/utils/logger.js
const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = levels[process.env.LOG_LEVEL || 'info'] ?? 2;
const svc = process.env.SERVICE_NAME || 'service';

const fmt = (level, msg, meta) => {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] [${svc}] ${msg}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
};

const logger = {
  error: (msg, meta) => { if (currentLevel >= 0) console.error(fmt('error', msg, meta)); },
  warn:  (msg, meta) => { if (currentLevel >= 1) console.warn(fmt('warn',  msg, meta)); },
  info:  (msg, meta) => { if (currentLevel >= 2) console.log(fmt('info',   msg, meta)); },
  debug: (msg, meta) => { if (currentLevel >= 3) console.log(fmt('debug',  msg, meta)); },
};

module.exports = logger;
