// Tiny structured logger. Wraps console.* with a consistent JSON-ish format
// so production log aggregators (Vercel, Datadog) can parse messages without
// custom regex. In dev, output stays human-readable.

type Level = 'debug' | 'info' | 'warn' | 'error'

interface LogFields {
  [k: string]: unknown
}

const isProd = process.env.NODE_ENV === 'production'

function emit(level: Level, scope: string, message: string, fields?: LogFields) {
  const target =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  if (isProd) {
    target(
      JSON.stringify({
        ts: new Date().toISOString(),
        level,
        scope,
        message,
        ...fields,
      }),
    )
  } else {
    const tag = `[${scope}]`
    if (fields && Object.keys(fields).length > 0) {
      target(tag, message, fields)
    } else {
      target(tag, message)
    }
  }
}

export function logger(scope: string) {
  return {
    debug: (msg: string, fields?: LogFields) => emit('debug', scope, msg, fields),
    info: (msg: string, fields?: LogFields) => emit('info', scope, msg, fields),
    warn: (msg: string, fields?: LogFields) => emit('warn', scope, msg, fields),
    error: (msg: string, fields?: LogFields) => emit('error', scope, msg, fields),
  }
}
