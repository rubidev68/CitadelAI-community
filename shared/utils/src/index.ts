/**
 * Shared Utilities Package
 * Export all utilities from a single entry point
 */

export * from './logger';
export * from './correlationId';
export * from './middleware';
// Note: prisma.ts is not exported - services should use their own PrismaClient
export * from './errorFormatter';
export * from './validation'; // Legacy validation utilities (type guards)
export * from './validation/index'; // New Zod-based validation (schemas, middleware, sanitization)
export * from './dateTime';
export * from './dbResultFormatter';
export * from './credentialEncryption';
export * from './serviceRegistry';
export * from './mermaidUtils';

