/**
 * Prisma Client
 * Singleton pattern to prevent connection pool exhaustion
 * Includes connection pool configuration
 */

import { PrismaClient } from '@prisma/client';
import { config } from '../config';

// Singleton pattern for PrismaClient to avoid connection pool exhaustion
let prisma: PrismaClient | null = null;

/**
 * Get Prisma client with connection pool configuration
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // Configure connection pool via DATABASE_URL parameters
    const databaseUrl = config.DATABASE_URL;
    
    // Parse and enhance connection string with pool parameters if not already present
    let enhancedUrl = databaseUrl;
    if (databaseUrl && !databaseUrl.includes('connection_limit')) {
      const connectionLimit = '10'; // Default, can be added to config if needed
      const poolTimeout = '10'; // Default, can be added to config if needed
      
      // Add connection pool parameters to URL
      const separator = databaseUrl.includes('?') ? '&' : '?';
      enhancedUrl = `${databaseUrl}${separator}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;
    }

    prisma = new PrismaClient({
      log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: enhancedUrl,
        },
      },
    });
  }
  return prisma;
}

/**
 * Health check for Prisma connection
 */
export async function checkPrismaHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  try {
    if (!prisma) {
      return { healthy: false, error: 'Prisma client not initialized' };
    }
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;
    return { healthy: true, latency };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export default instance
export default getPrismaClient();
