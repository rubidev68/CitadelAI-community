import express from 'express';
import CrawlingService from './crawling';
import OptimizedCrawlingService from './optimized-crawling';
import crawlRoutes from './routes/crawl';
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

const crawlingService = new CrawlingService();
const optimizedCrawlingService = new OptimizedCrawlingService();

// Routes
app.use('/', crawlRoutes(crawlingService, optimizedCrawlingService));

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Crawling service listening on port ${port}`);
});
