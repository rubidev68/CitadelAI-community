/**
 * Prisma Client Factory Pattern
 * 
 * NOTE: This package does NOT create PrismaClient instances because each service
 * has its own Prisma schema. Services should implement the singleton pattern
 * locally in their own prisma.ts files.
 * 
 * This file is kept for documentation purposes and to maintain the shared
 * package structure, but services should NOT import from here for Prisma.
 * 
 * Each service should have its own prisma.ts file with:
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * 
 * let prisma: PrismaClient | null = null;
 * 
 * export function getPrismaClient(): PrismaClient {
 *   if (!prisma) {
 *     prisma = new PrismaClient({
 *       log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
 *     });
 *   }
 *   return prisma;
 * }
 * 
 * export default getPrismaClient();
 * ```
 */

// This file is intentionally empty - services should use their own PrismaClient
// We don't export anything to prevent accidental usage
