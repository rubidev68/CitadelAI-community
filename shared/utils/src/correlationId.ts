/**
 * Correlation ID utilities for distributed tracing
 * Uses AsyncLocalStorage for Node.js to maintain correlation IDs across async operations
 */

let correlationIdStore: {
  getStore: () => string | undefined;
  enterWith: (id: string) => void;
} | null = null;

/**
 * Initialize AsyncLocalStorage for correlation IDs (Node.js only)
 */
function initCorrelationIdStore(): void {
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      // Dynamic require to avoid issues in browser environments
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const asyncHooks = require('async_hooks');
      const AsyncLocalStorage = asyncHooks.AsyncLocalStorage;
      const store = new AsyncLocalStorage();
      
      correlationIdStore = {
        getStore: () => store.getStore() as string | undefined,
        enterWith: (id: string) => store.enterWith(id),
      };
    } catch (error) {
      // AsyncLocalStorage not available, use fallback
      // Using console.warn here is acceptable as this is initialization code
      // eslint-disable-next-line no-console
      console.warn('AsyncLocalStorage not available, using fallback for correlation IDs');
    }
  }
}

// Initialize on module load
initCorrelationIdStore();

/**
 * Fallback storage for environments without AsyncLocalStorage
 */
let fallbackCorrelationId: string | undefined;

/**
 * Generate a new correlation ID
 * Format: {service}-{timestamp}-{random}
 * 
 * @param service Optional service name prefix
 * @returns Generated correlation ID
 */
export function generateCorrelationId(service?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).substring(2, 9);
  const prefix = service ? `${service}-` : '';
  return `${prefix}${timestamp}-${random}`;
}

/**
 * Get the current correlation ID from context
 * 
 * @returns Current correlation ID or undefined
 */
export function getCorrelationId(): string | undefined {
  if (correlationIdStore) {
    return correlationIdStore.getStore();
  }
  return fallbackCorrelationId;
}

/**
 * Set the correlation ID for the current context
 * 
 * @param id Correlation ID to set
 */
export function setCorrelationId(id: string): void {
  if (correlationIdStore) {
    correlationIdStore.enterWith(id);
  } else {
    fallbackCorrelationId = id;
  }
}

/**
 * Clear the current correlation ID
 */
export function clearCorrelationId(): void {
  if (correlationIdStore) {
    // AsyncLocalStorage doesn't have a clear method, so we set to undefined
    correlationIdStore.enterWith(undefined as unknown as string);
  } else {
    fallbackCorrelationId = undefined;
  }
}
