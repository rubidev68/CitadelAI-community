import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const { checkPrismaHealth } = await import('../lib/prisma');
    const { getPoolManager } = await import('@shared/services');
    const { getHealthCheckService } = await import('@shared/services');

    // Check Prisma connection
    const prismaHealth = await checkPrismaHealth();
    
    // Get pool manager and health check service
    const poolManager = getPoolManager();
    const healthService = getHealthCheckService();
    
    // Get pool statistics
    const allPoolStats = poolManager.getAllPoolStats();
    const overallHealth = healthService.getOverallHealth();

    res.status(200).json({
      status: prismaHealth.healthy && overallHealth.healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        prisma: {
          status: prismaHealth.healthy ? 'connected' : 'disconnected',
          latency: prismaHealth.latency,
          error: prismaHealth.error,
        },
        pools: Object.fromEntries(allPoolStats),
        overall: overallHealth,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
