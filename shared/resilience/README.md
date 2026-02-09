# Resilience Library

Global resilience library for service-to-service communication in the CitadelAI microservices architecture.

## Features

- **Retry Logic**: Automatic retry with exponential backoff, linear, or fixed delays
- **Circuit Breaker**: Prevents cascading failures by stopping requests to failing services
- **Health Checks**: Periodic health monitoring with cached status
- **Metrics Collection**: Request counts, latencies, circuit breaker states, retry counts
- **Error Classification**: Smart error handling (retryable vs non-retryable)

## Installation

The library is located in `shared/resilience/`. To use it in a service:

1. Build the library:
```bash
cd shared/resilience
npm install
npm run build
```

2. Import in your service:
```typescript
import { createResilientClient } from '../../../shared/resilience';
```

## Usage

### Basic Example

```typescript
import { createResilientClient } from '@shared/resilience';

const client = createResilientClient({
  baseURL: 'http://email-service:3008',
  serviceName: 'email-service',
  timeout: 30000,
  retry: {
    attempts: 5,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 16000,
    jitter: true,
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000,
    successThreshold: 2,
  },
  healthCheck: {
    enabled: true,
    endpoint: '/health',
    interval: 30000,
    timeout: 5000,
  },
});

// Use like normal axios
const response = await client.post('/api/email/send', { to: '...', subject: '...' });
```

### Configuration Options

#### Retry Configuration
- `attempts`: Maximum number of retry attempts (default: 3)
- `backoff`: Strategy - 'exponential', 'linear', or 'fixed'
- `initialDelay`: Initial delay in ms (default: 1000)
- `maxDelay`: Maximum delay in ms (default: 30000)
- `jitter`: Add randomization to delays (default: false)

#### Circuit Breaker Configuration
- `failureThreshold`: Number of failures before opening circuit (default: 5)
- `resetTimeout`: Time in ms before attempting to close circuit (default: 30000)
- `successThreshold`: Successful requests needed to close from half-open (default: 1)
- `timeWindow`: Time window in ms for tracking failures (default: 60000)

#### Health Check Configuration
- `enabled`: Enable health checks (default: false)
- `endpoint`: Health check endpoint path (default: '/health')
- `interval`: Health check interval in ms (default: 30000)
- `timeout`: Health check timeout in ms (default: 5000)

## Error Handling

The library automatically classifies errors:

**Retryable Errors:**
- Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, ECONNRESET)
- 5xx server errors
- 429 Too Many Requests

**Non-Retryable Errors:**
- 4xx client errors (except 429)

**Circuit Breaker Triggers:**
- Network errors
- 5xx server errors
- Consecutive failures > threshold

## Metrics

Access metrics for monitoring:

```typescript
import { metricsCollector } from '@shared/resilience';

// Get metrics for a service
const metrics = metricsCollector.getMetrics('email-service');
console.log(metrics);
// {
//   requests: { total: 100, success: 95, failure: 5, successRate: '95.00%' },
//   latency: { p50: 120, p95: 250, p99: 500, avg: 150 },
//   circuitBreaker: { state: 'CLOSED' },
//   retries: 10
// }

// Get all metrics
const allMetrics = metricsCollector.getAllMetrics();
```

## Examples

See:
- `admin/backend/src/services/emailServiceClient.ts` - Email service client
- `admin/backend/src/services/serviceClients.ts` - Crawling and cron scheduler clients
- `admin/backend/src/routes/crawling.ts` - Usage in routes

## Architecture

```
ResilientHttpClient
├── CircuitBreaker (state management)
├── RetryStrategy (retry logic)
├── HealthChecker (health monitoring)
└── MetricsCollector (metrics)
```

## Best Practices

1. **Configure per service**: Different services have different requirements
   - Email service: High retry count (5 attempts)
   - Crawling service: Longer timeout (60s)
   - Cron scheduler: Lower retry count (2 attempts)

2. **Enable health checks**: For critical services that should be checked before requests

3. **Monitor metrics**: Use metrics to adjust configurations based on real-world usage

4. **Handle errors gracefully**: Circuit breaker opens don't mean permanent failure - service may recover

## Future Enhancements

- Request queue for critical operations
- Distributed tracing integration
- Prometheus metrics export
- Service discovery integration
