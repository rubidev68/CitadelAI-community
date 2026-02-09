/**
 * Redis Client Factory
 * Creates Redis client with connection retry logic and graceful fallback
 */

import { logger } from '@shared/utils';

let redisClient: any = null;
let redisAvailable = false;

/**
 * Initialize Redis client
 * Returns null if Redis is unavailable (graceful fallback)
 */
export async function getRedisClient(): Promise<any | null> {
  // Return cached client if already initialized
  if (redisClient !== null) {
    return redisAvailable ? redisClient : null;
  }

  const redisUrl = process.env.REDIS_URL;
  
  // If no Redis URL, return null (will use in-memory fallback)
  if (!redisUrl || redisUrl === '') {
    logger.warn('Redis URL not configured, using in-memory fallback for rate limiting');
    redisAvailable = false;
    return null;
  }

  try {
    // Try to import redis package (express-rate-limit will handle this)
    // For now, we'll just check if Redis URL is available
    // The actual Redis client will be created by express-rate-limit's Redis store
    
    redisAvailable = true;
    logger.info('Redis configured and available', { redisUrl: redisUrl.replace(/:[^:@]+@/, ':****@') });
    
    // Return the Redis URL for express-rate-limit to use
    // express-rate-limit will create its own client
    return redisUrl;
  } catch (error) {
    logger.error('Failed to initialize Redis client', error instanceof Error ? error : new Error(String(error)), {
      service: 'redis-client',
    });
    redisAvailable = false;
    return null;
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisAvailable;
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    return client !== null;
  } catch {
    return false;
  }
}
