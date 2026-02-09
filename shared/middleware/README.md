# @shared/middleware

Shared Express middleware for CitadelAI services. This package provides reusable authentication, rate limiting, error handling, and response formatting middleware that can be used across all services.

## Installation

This package is installed as a local file dependency in services:

```json
{
  "dependencies": {
    "@shared/middleware": "file:../../shared/middleware"
  }
}
```

## Features

- **JWT Authentication**: Configurable JWT-based authentication for admin and regular users
- **API Token Authentication**: Token-based authentication for public API endpoints
- **Rate Limiting**: Configurable rate limiters with presets for different use cases
- **Error Handling**: Standardized error handling with logging and correlation IDs
- **Response Formatting**: Consistent API response structures

## Usage

### JWT Authentication

Create JWT authentication middleware for admin or regular users:

```typescript
import { createJwtAuthMiddleware } from '@shared/middleware';
import prisma from './lib/prisma';
import { logger } from '@shared/utils';

// For admin users
const adminAuthMiddleware = createJwtAuthMiddleware<AdminAuthRequest>({
  prisma,
  jwtSecret: process.env.JWT_SECRET!,
  model: 'adminUser',
  requestProperty: 'adminUser',
  logger,
});

// For regular users
const userAuthMiddleware = createJwtAuthMiddleware<UserAuthRequest>({
  prisma,
  jwtSecret: process.env.JWT_SECRET!,
  model: 'user',
  requestProperty: 'user',
  logger,
});
```

**Configuration Options:**
- `prisma`: Prisma client instance
- `jwtSecret`: JWT secret for token verification
- `model`: Database model name (`'adminUser'` or `'user'`)
- `requestProperty`: Property name to attach to request (`'adminUser'` or `'user'`)
- `logger`: Optional logger instance

**Request Types:**
Services should define their own Request-extending types:

```typescript
export interface AdminAuthRequest extends Request {
  adminUser?: { id: string; email: string };
}

export interface UserAuthRequest extends Request {
  user?: { id: string; email: string };
}
```

**JWT Payload Structure:**
- Admin users: `{ id: string; email: string }`
- Regular users: `{ userId: string; email: string }`

### API Token Authentication

Create API token authentication middleware:

```typescript
import { createApiTokenAuthMiddleware } from '@shared/middleware';
import { findTokenByValue, validateToken, incrementUsage } from './services/apiTokenService';
import prisma from './lib/prisma';
import { logger } from '@shared/utils';

const authenticateApiToken = createApiTokenAuthMiddleware<ApiAuthRequest>({
  findTokenByValue,
  validateToken,
  incrementUsage,
  prisma,
  logger,
});
```

**Configuration Options:**
- `findTokenByValue`: Function to find token by value in database
- `validateToken`: Function to validate token (check expiration, usage limits, etc.)
- `incrementUsage`: Optional function to increment token usage counter
- `prisma`: Prisma client instance
- `logger`: Optional logger instance
- `extractChatbotId`: Optional function to extract chatbot ID from request (default: `req.params.chatbotId`)

**Request Type:**
```typescript
export interface ApiAuthRequest extends Request {
  apiToken?: ApiToken;
  chatbotId?: string;
}
```

**Token Validation:**
The `validateToken` function should return:
```typescript
{
  valid: boolean;
  reason?: string;
}
```

### Rate Limiting

#### Custom Rate Limiter

Create a custom rate limiter:

```typescript
import { createRateLimiter } from '@shared/middleware';

const customLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  options: {
    skip: (req) => req.ip === '127.0.0.1', // Skip localhost
  },
});
```

#### Presets

Use pre-configured rate limiters:

```typescript
import {
  authRateLimit,
  globalRateLimit,
  strictRateLimit,
  twoFactorRateLimit,
} from '@shared/middleware';

// Authentication endpoints (stricter limits)
app.use('/api/auth', authRateLimit);

// Global API endpoints
app.use('/api', globalRateLimit);

// Admin endpoints (very strict)
app.use('/api/admin', strictRateLimit);

// Two-factor authentication endpoints
app.use('/api/auth/2fa', twoFactorRateLimit);
```

**Preset Configurations:**
- `authRateLimit`: 5 requests per 15 minutes (authentication endpoints)
- `globalRateLimit`: 100 requests per 15 minutes (general API)
- `strictRateLimit`: 10 requests per 15 minutes (sensitive operations)
- `twoFactorRateLimit`: 3 requests per 15 minutes (2FA endpoints)

### Error Handling

Create error handling middleware:

```typescript
import { createErrorHandler } from '@shared/middleware';
import { logger } from '@shared/utils';

const errorHandler = createErrorHandler({
  logger,
  includeStack: process.env.NODE_ENV === 'development',
  includeDetails: process.env.NODE_ENV === 'development',
});

// Use as last middleware
app.use(errorHandler);
```

**Configuration Options:**
- `logger`: Optional logger instance
- `includeStack`: Include stack trace in response (default: `NODE_ENV === 'development'`)
- `includeDetails`: Include error details in response (default: `NODE_ENV === 'development'`)

**Error Response Format:**
```json
{
  "error": "Internal Server Error",
  "message": "Error message",
  "code": "ERROR_CODE",
  "details": {},
  "stack": "...",
  "requestId": "correlation-id"
}
```

### Response Formatting

Use standardized response formatters:

```typescript
import {
  sendSuccessResponse,
  sendErrorResponse,
  successResponse,
  errorResponse,
} from '@shared/middleware';

// In route handlers
router.get('/users', async (req, res) => {
  const users = await getUsers();
  sendSuccessResponse(res, users);
});

router.post('/users', async (req, res) => {
  try {
    const user = await createUser(req.body);
    sendSuccessResponse(res, user, 201);
  } catch (error) {
    sendErrorResponse(res, 400, 'Validation error', 'VALIDATION_ERROR', {
      field: 'email',
    });
  }
});
```

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE",
    "details": { ... }
  }
}
```

## Type Safety

All middleware functions are fully typed with TypeScript. Services should define their own Request-extending types to avoid type conflicts between different `@types/express` versions.

## Migration Guide

### From Old Middleware to Shared Middleware

**Before:**
```typescript
// admin/backend/src/middleware/adminAuth.ts
export const adminAuthMiddleware = async (req, res, next) => {
  // Custom implementation
};
```

**After:**
```typescript
// admin/backend/src/middleware/adminAuth.ts
import { createJwtAuthMiddleware } from '@shared/middleware';

export const adminAuthMiddleware = createJwtAuthMiddleware<AdminAuthRequest>({
  prisma,
  jwtSecret: process.env.JWT_SECRET!,
  model: 'adminUser',
  requestProperty: 'adminUser',
  logger,
}) as unknown as RequestHandler;
```

The API contract remains the same, so existing route handlers don't need to change.

## Testing

Run tests:
```bash
cd shared/middleware
npm test
```

Watch mode:
```bash
npm run test:watch
```

## Troubleshooting

### Type Conflicts

If you encounter type conflicts between different `@types/express` versions:

1. Ensure `@types/express` is in `peerDependencies` (already done)
2. Services should define their own Request-extending types locally
3. Use type assertions (`as unknown as RequestHandler`) when needed

### Build Errors

If the shared middleware isn't found during build:

1. Ensure `shared/middleware` is built: `cd shared/middleware && npm run build`
2. Check Dockerfile includes `shared/middleware` in build steps
3. Verify `package.json` includes the dependency

### Runtime Errors

If middleware doesn't work at runtime:

1. Check that Prisma client is properly initialized
2. Verify JWT_SECRET is set in environment
3. Check logger is properly configured
4. Review error logs for specific issues

## API Reference

### `createJwtAuthMiddleware<T>(config: JwtAuthConfig)`

Creates JWT authentication middleware.

**Parameters:**
- `config`: Configuration object (see JWT Authentication section)

**Returns:** Express middleware function

### `createApiTokenAuthMiddleware<T>(config: ApiTokenAuthConfig)`

Creates API token authentication middleware.

**Parameters:**
- `config`: Configuration object (see API Token Authentication section)

**Returns:** Express middleware function

### `createRateLimiter(config: RateLimiterConfig)`

Creates a rate limiter middleware.

**Parameters:**
- `config`: Configuration object (see Rate Limiting section)

**Returns:** Express rate limit middleware

### `createErrorHandler(config?: ErrorHandlerConfig)`

Creates error handling middleware.

**Parameters:**
- `config`: Optional configuration object (see Error Handling section)

**Returns:** Express error handler middleware

### Response Formatters

- `successResponse(data?: unknown)`: Creates success response object
- `errorResponse(message: string, code?: string, details?: unknown)`: Creates error response object
- `sendSuccessResponse(res: Response, data?: unknown, statusCode?: number)`: Sends success response
- `sendErrorResponse(res: Response, statusCode: number, message: string, code?: string, details?: unknown)`: Sends error response

## Contributing

When adding new middleware:

1. Add to appropriate subdirectory (`auth/`, `rateLimiter/`, etc.)
2. Export from `src/index.ts`
3. Add tests in `src/__tests__/`
4. Update this README
5. Ensure backward compatibility

## License

Internal package for CitadelAI services.
