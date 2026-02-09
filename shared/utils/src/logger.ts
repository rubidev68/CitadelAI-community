/**
 * Unified Logger for both Node.js (backend) and browser (frontend) environments
 * Supports log levels, structured JSON logging, correlation IDs, and child loggers
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Metadata object for structured logging
 */
export interface LogMetadata {
  [key: string]: unknown;
  correlationId?: string;
  userId?: string;
  requestId?: string;
  service?: string;
  duration?: number;
  error?: Error | {
    name?: string;
    message?: string;
    stack?: string;
    code?: string | number;
    [key: string]: unknown;
  };
}

/**
 * Enhanced Logger interface with structured logging support
 */
export interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, error?: Error, metadata?: LogMetadata): void;
  
  // Legacy support - variadic args
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  
  // New methods
  child(metadata: LogMetadata): Logger;
  setCorrelationId(id: string): void;
  getCorrelationId(): string | undefined;
  setLevel(level: LogLevel): void;
}

/**
 * Check if running in Node.js environment
 */
function isNodeEnvironment(): boolean {
  return typeof process !== 'undefined' && process.versions?.node != null;
}

/**
 * Check if running in browser environment
 */
function isBrowserEnvironment(): boolean {
  // Check for window object (browser) - use globalThis to avoid TypeScript errors
  try {
    // @ts-ignore - window may not be defined in Node.js
    return typeof globalThis.window !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Get log level from environment
 */
function getLogLevel(): LogLevel {
  if (isNodeEnvironment()) {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    return LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
  }
  
  // Browser environment - check for Vite env vars
  if (isBrowserEnvironment()) {
    try {
      // Define interface for Vite environment
      interface ViteEnv {
        LOG_LEVEL?: string;
        VITE_LOG_LEVEL?: string;
        [key: string]: string | undefined;
      }
      
      interface WindowWithViteEnv {
        __VITE_ENV__?: ViteEnv;
      }
      
      interface GlobalThisWithWindow {
        window?: WindowWithViteEnv;
      }
      
      const globalWithWindow = globalThis as GlobalThisWithWindow;
      const viteEnv: ViteEnv = (globalWithWindow.window?.__VITE_ENV__) || 
                      (typeof process !== 'undefined' && (process.env as ViteEnv)) || {};
      const envLevel = (viteEnv?.LOG_LEVEL || viteEnv?.VITE_LOG_LEVEL)?.toUpperCase() || 'INFO';
      return LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
    } catch {
      return LogLevel.INFO;
    }
  }
  
  return LogLevel.INFO;
}

/**
 * Check if we're in development mode
 */
function isDevelopment(): boolean {
  if (isNodeEnvironment()) {
    return process.env.NODE_ENV === 'development';
  }
  
  if (isBrowserEnvironment()) {
    try {
      // Define interface for Vite environment
      interface ViteEnv {
        DEV?: boolean;
        MODE?: string;
        NODE_ENV?: string;
        [key: string]: string | boolean | undefined;
      }
      
      interface WindowWithViteEnv {
        __VITE_ENV__?: ViteEnv;
      }
      
      interface GlobalThisWithWindow {
        window?: WindowWithViteEnv;
      }
      
      const globalWithWindow = globalThis as GlobalThisWithWindow;
      const viteEnv: ViteEnv = (globalWithWindow.window?.__VITE_ENV__) || 
                      (typeof process !== 'undefined' && (process.env as ViteEnv)) || {};
      return viteEnv?.DEV === true || viteEnv?.MODE === 'development' || viteEnv?.NODE_ENV === 'development';
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Check if structured JSON logging should be used
 */
function shouldUseStructuredLogging(): boolean {
  if (!isNodeEnvironment()) {
    return false; // Browser doesn't use JSON logging
  }
  
  // Use structured logging in production or when explicitly enabled
  const useStructured = process.env.STRUCTURED_LOGGING === 'true' || 
                       process.env.NODE_ENV === 'production';
  return useStructured;
}

/**
 * Create a logger instance
 */
class LoggerImpl implements Logger {
  private level: LogLevel;
  private dev: boolean;
  private useStructured: boolean;
  private correlationId?: string;
  private baseMetadata: LogMetadata;

  constructor(baseMetadata: LogMetadata = {}) {
    this.level = getLogLevel();
    this.dev = isDevelopment();
    this.useStructured = shouldUseStructuredLogging();
    this.baseMetadata = baseMetadata;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  /**
   * Get correlation ID from context or stored value
   */
  private getContextCorrelationId(): string | undefined {
    // Try to get from AsyncLocalStorage if available (Node.js)
    if (isNodeEnvironment()) {
      try {
        // Lazy require to avoid circular dependencies
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const correlationIdModule = require('./correlationId');
        if (correlationIdModule && typeof correlationIdModule.getCorrelationId === 'function') {
          return correlationIdModule.getCorrelationId();
        }
      } catch {
        // Fallback to stored value
      }
    }
    return this.correlationId || this.baseMetadata.correlationId;
  }

  /**
   * Format error for logging
   */
  private formatError(error: Error | LogMetadata['error']): LogMetadata['error'] {
    if (!error) return undefined;
    
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error as { code?: string | number }).code && { code: (error as { code?: string | number }).code },
      };
    }
    
    return error;
  }

  /**
   * Build log entry with all metadata
   */
  private buildLogEntry(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    error?: Error
  ): Record<string, unknown> {
    const correlationId = this.getContextCorrelationId();
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    
    const entry: Record<string, unknown> = {
      timestamp,
      level: levelName,
      message,
      ...this.baseMetadata,
      ...metadata,
    };

    // Add correlation ID if available
    if (correlationId) {
      entry.correlationId = correlationId;
    }

    // Add error information if present
    if (error) {
      entry.error = this.formatError(error);
    } else if (metadata?.error) {
      entry.error = this.formatError(metadata.error);
    }

    return entry;
  }

  /**
   * ANSI color codes for terminal output
   */
  private getColorCode(level: LogLevel): string {
    if (!this.dev || !isNodeEnvironment()) {
      return ''; // No colors in production or browser
    }
    
    // Check if terminal supports colors
    const supportsColor = process.env.FORCE_COLOR !== '0' && 
                         (process.stdout?.isTTY || process.env.TERM !== 'dumb');
    
    if (!supportsColor) {
      return '';
    }
    
    switch (level) {
      case LogLevel.DEBUG:
        return '\x1b[36m'; // Cyan
      case LogLevel.INFO:
        return '\x1b[32m'; // Green
      case LogLevel.WARN:
        return '\x1b[33m'; // Yellow
      case LogLevel.ERROR:
        return '\x1b[31m'; // Red
      default:
        return '';
    }
  }
  
  private getResetCode(): string {
    if (!this.dev || !isNodeEnvironment()) {
      return '';
    }
    const supportsColor = process.env.FORCE_COLOR !== '0' && 
                         (process.stdout?.isTTY || process.env.TERM !== 'dumb');
    return supportsColor ? '\x1b[0m' : '';
  }

  /**
   * Format message for development (pretty print with colors)
   */
  private formatMessage(level: LogLevel, message: string, metadata?: LogMetadata, error?: Error): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const correlationId = this.getContextCorrelationId();
    const color = this.getColorCode(level);
    const reset = this.getResetCode();
    
    // Format timestamp (shorter format for readability)
    const timeStr = timestamp.replace('T', ' ').replace(/\.\d{3}Z$/, '');
    
    // Build main log line
    let formatted = `${color}[${timeStr}]${reset} ${color}${levelName.padEnd(5)}${reset} ${message}`;
    
    // Add service name if available
    const service = metadata?.service || this.baseMetadata.service;
    if (service) {
      formatted += ` ${color}(${service})${reset}`;
    }
    
    // Add correlation ID
    if (correlationId) {
      formatted += ` ${color}[cid:${correlationId.substring(0, 8)}]${reset}`;
    }
    
    // Add error information
    if (error) {
      formatted += `\n${color}  ✗ Error:${reset} ${error.message}`;
      if (error.stack) {
        // Indent stack trace
        const stackLines = error.stack.split('\n').slice(1);
        formatted += `\n${color}  Stack:${reset}\n${stackLines.map(line => `  ${line}`).join('\n')}`;
      }
    }
    
    // Add metadata (exclude service and correlationId as they're already shown)
    if (metadata) {
      const filteredMetadata: LogMetadata = { ...metadata };
      delete filteredMetadata.service;
      delete filteredMetadata.correlationId;
      
      if (Object.keys(filteredMetadata).length > 0) {
        const metadataStr = JSON.stringify(filteredMetadata, null, 2)
          .split('\n')
          .map((line, idx) => idx === 0 ? `  ${line}` : `  ${line}`)
          .join('\n');
        formatted += `\n${color}  →${reset} ${metadataStr}`;
      }
    }
    
    return formatted;
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    metadataOrError?: LogMetadata | Error,
    metadata?: LogMetadata
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    // Handle variadic args (legacy support)
    if (arguments.length > 2 && !metadata && typeof metadataOrError !== 'object') {
      // Legacy variadic args - convert to metadata
      const args = Array.from(arguments).slice(2);
      const legacyMetadata: LogMetadata = {};
      if (args.length > 0) {
        legacyMetadata.data = args.length === 1 ? args[0] : args;
      }
      this.logStructured(level, message, legacyMetadata);
      return;
    }

    // Handle new structured logging
    const error = metadataOrError instanceof Error ? metadataOrError : undefined;
    const logMetadata = metadata || (metadataOrError instanceof Error ? undefined : metadataOrError as LogMetadata);
    
    this.logStructured(level, message, logMetadata, error);
  }

  /**
   * Log with structured format
   */
  private logStructured(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    error?: Error
  ): void {
    if (this.useStructured) {
      // JSON structured logging for production
      const entry = this.buildLogEntry(level, message, metadata, error);
      const jsonOutput = JSON.stringify(entry);
      
      if (level === LogLevel.ERROR) {
        console.error(jsonOutput);
      } else if (level === LogLevel.WARN) {
        console.warn(jsonOutput);
      } else {
        console.log(jsonOutput);
      }
    } else {
      // Pretty-printed logging for development
      const formattedMessage = this.formatMessage(level, message, metadata, error);
      
      if (level === LogLevel.ERROR) {
        console.error(formattedMessage);
      } else if (level === LogLevel.WARN) {
        console.warn(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
    }
  }

  // Public API methods
  debug(message: string, metadataOrArgs?: LogMetadata | unknown, ...args: unknown[]): void {
    if (args.length > 0 || (metadataOrArgs && typeof metadataOrArgs !== 'object')) {
      // Legacy variadic args - convert to metadata
      const legacyMetadata: LogMetadata = {};
      if (metadataOrArgs !== undefined) {
        legacyMetadata.data = args.length > 0 ? [metadataOrArgs, ...args] : metadataOrArgs;
      } else if (args.length > 0) {
        legacyMetadata.data = args.length === 1 ? args[0] : args;
      }
      this.logStructured(LogLevel.DEBUG, message, legacyMetadata);
    } else {
      this.log(LogLevel.DEBUG, message, metadataOrArgs as LogMetadata);
    }
  }

  info(message: string, metadataOrArgs?: LogMetadata | unknown, ...args: unknown[]): void {
    if (args.length > 0 || (metadataOrArgs && typeof metadataOrArgs !== 'object')) {
      // Legacy variadic args - convert to metadata
      const legacyMetadata: LogMetadata = {};
      if (metadataOrArgs !== undefined) {
        legacyMetadata.data = args.length > 0 ? [metadataOrArgs, ...args] : metadataOrArgs;
      } else if (args.length > 0) {
        legacyMetadata.data = args.length === 1 ? args[0] : args;
      }
      this.logStructured(LogLevel.INFO, message, legacyMetadata);
    } else {
      this.log(LogLevel.INFO, message, metadataOrArgs as LogMetadata);
    }
  }

  warn(message: string, metadataOrArgs?: LogMetadata | unknown, ...args: unknown[]): void {
    if (args.length > 0 || (metadataOrArgs && typeof metadataOrArgs !== 'object')) {
      // Legacy variadic args - convert to metadata
      const legacyMetadata: LogMetadata = {};
      if (metadataOrArgs !== undefined) {
        legacyMetadata.data = args.length > 0 ? [metadataOrArgs, ...args] : metadataOrArgs;
      } else if (args.length > 0) {
        legacyMetadata.data = args.length === 1 ? args[0] : args;
      }
      this.logStructured(LogLevel.WARN, message, legacyMetadata);
    } else {
      this.log(LogLevel.WARN, message, metadataOrArgs as LogMetadata);
    }
  }

  error(message: string, errorOrMetadata?: Error | LogMetadata | unknown, metadataOrArgs?: LogMetadata | unknown, ...args: unknown[]): void {
    if (errorOrMetadata instanceof Error) {
      // New signature: error(message, error, metadata?)
      this.log(LogLevel.ERROR, message, errorOrMetadata, metadataOrArgs as LogMetadata);
    } else if (args.length > 0 || (errorOrMetadata && typeof errorOrMetadata !== 'object' && errorOrMetadata !== null)) {
      // Legacy variadic args - convert to metadata
      const legacyMetadata: LogMetadata = {};
      if (errorOrMetadata !== undefined) {
        legacyMetadata.data = args.length > 0 ? [errorOrMetadata, ...args] : errorOrMetadata;
      } else if (args.length > 0) {
        legacyMetadata.data = args.length === 1 ? args[0] : args;
      }
      this.logStructured(LogLevel.ERROR, message, legacyMetadata);
    } else {
      // New signature: error(message, metadata?)
      this.log(LogLevel.ERROR, message, errorOrMetadata as LogMetadata);
    }
  }

  child(metadata: LogMetadata): Logger {
    return new LoggerImpl({
      ...this.baseMetadata,
      ...metadata,
    });
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
    this.baseMetadata.correlationId = id;
  }

  getCorrelationId(): string | undefined {
    return this.getContextCorrelationId();
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Export singleton instance
export const logger = new LoggerImpl();

// Export factory function for creating custom loggers
export function createLogger(): Logger {
  return new LoggerImpl();
}
