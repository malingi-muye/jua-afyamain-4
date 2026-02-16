export const VERBOSE = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.VITE_VERBOSE_LOGS === 'true' || (import.meta as any).env?.DEV)

// Save original console methods before anything can override them
const originalConsole = typeof console !== 'undefined' ? {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
} : {
  log: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
}

export const logger = {
  log: (...args: any[]) => {
    if (VERBOSE) originalConsole.log(...args)
  },
  warn: (...args: any[]) => {
    if (VERBOSE) originalConsole.warn(...args)
  },
  error: (...args: any[]) => {
    // Always show errors regardless of VERBOSE, but keep format consistent
    originalConsole.error(...args)
  },
  debug: (...args: any[]) => {
    if (VERBOSE) originalConsole.debug(...args)
  },
}

export default logger
