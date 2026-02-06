// File: src/utils/logger.js
/**
 * Simple logger utility with consistent formatting
 * Usage:
 *   import { createLogger } from '../utils/logger.js';
 *   const log = createLogger('ModuleName');
 *   log.info('message');  // [ModuleName] message
 *   log.warn('warning');  // [ModuleName] warning
 *   log.error('error');   // [ModuleName] error
 *   log.debug('debug');   // [ModuleName] debug (only if DEBUG=true)
 */

// Enable debug logging via localStorage or global flag
const isDebugEnabled = () => {
  try {
    return localStorage.getItem('debug') === 'true' || window.DEBUG === true;
  } catch {
    return false;
  }
};

/**
 * Create a logger instance for a module
 * @param {string} moduleName - Name to prefix log messages with
 * @returns {Object} Logger with info, warn, error, debug methods
 */
export function createLogger(moduleName) {
  const prefix = `[${moduleName}]`;

  return {
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
    debug: (...args) => {
      if (isDebugEnabled()) {
        console.log(prefix, '[DEBUG]', ...args);
      }
    },
    // Convenience alias
    log: (...args) => console.log(prefix, ...args),
  };
}

// Pre-built loggers for common modules
export const appLog = createLogger('App');
export const editorLog = createLogger('Editor');
export const automergeLog = createLogger('Automerge');
export const awarenessLog = createLogger('Awareness');
export const githubLog = createLogger('GitHub');
