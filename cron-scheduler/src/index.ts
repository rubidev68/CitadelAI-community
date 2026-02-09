import express from 'express';
import { PrismaClient } from '@prisma/client';
import CronScheduler from './cronScheduler';
import cronRoutes from './routes/cron';
import { securityHeadersMiddleware, createCorsMiddleware } from '@shared/middleware';
import { config } from './config';

const app = express();

// Security headers middleware (must be before other middleware)
app.use(securityHeadersMiddleware({
  enableCSP: true,
}) as any);

// CORS middleware (internal service - restrict origins)
app.use(createCorsMiddleware({
  allowCredentials: true,
}) as any);

app.use(express.json());

const prisma = new PrismaClient();
const cronScheduler = new CronScheduler(prisma);

// Initialize cron scheduler on startup
cronScheduler.initialize();

// Routes
app.use('/', cronRoutes(prisma, cronScheduler));

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down cron scheduler...');
  cronScheduler.shutdown();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down cron scheduler...');
  cronScheduler.shutdown();
  await prisma.$disconnect();
  process.exit(0);
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Cron scheduler service listening on port ${port}`);
});

export default app;
