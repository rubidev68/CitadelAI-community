# Service Structure Documentation

**Last Updated:** 2026-01-08  
**Status:** ✅ Active Standard

This document defines the standardized structure for all services in the CathedralAI codebase, following the code organization improvements outlined in `CODEBASE_IMPROVEMENTS_PROPOSAL.md`.

**Implementation Status:** ✅ **COMPLETE** - All services have been standardized as of 2026-01-08.

## Overview

All services follow a consistent structure that separates concerns:
- **Routes** (`routes/`): Thin routing layer that delegates to controllers
- **Controllers** (`controllers/`): Business logic handlers for HTTP requests
- **Services** (`services/`): Reusable business logic and external integrations
- **Utils** (`utils/` or `controllers/*/utils/`): Helper functions and utilities
- **Types** (`types/`): TypeScript type definitions
- **Lib** (`lib/`): Library setup (e.g., Prisma client)

## Standard Structure

```
service-name/
├── src/
│   ├── index.ts                    # Main entry point, Express app setup
│   ├── routes/                     # Route definitions (thin layer)
│   │   ├── *.ts                    # Route files (delegate to controllers)
│   ├── controllers/                # Request handlers
│   │   ├── feature/                # Feature-specific controllers
│   │   │   ├── featureController.ts
│   │   │   ├── utils/              # Feature-specific utilities
│   │   │   │   └── *.ts
│   │   │   └── index.ts            # Re-exports
│   ├── services/                   # Business logic services
│   │   └── *.ts
│   ├── types/                      # TypeScript types
│   │   └── *.ts
│   ├── lib/                        # Library setup
│   │   └── prisma.ts
│   └── middleware/                 # Express middleware (if needed)
│       └── *.ts
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Route Files

Route files should be **thin routing layers** that:
1. Import controllers from `controllers/`
2. Define route paths and HTTP methods
3. Apply middleware (authentication, validation, etc.)
4. Delegate to controller functions

**Example:**
```typescript
import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import {
  handleGetResource,
  handleCreateResource,
} from '../controllers/resource/resourceController';

const router = Router();

router.get('/:id', adminAuthMiddleware, handleGetResource);
router.post('/', adminAuthMiddleware, handleCreateResource);

export default router;
```

**Guidelines:**
- Keep route files under 100 lines when possible
- Extract complex middleware configuration to separate files if needed
- Use consistent naming: `handle<Action><Resource>` (e.g., `handleGetUser`, `handleCreateSubscription`)

## Controller Files

Controllers contain the business logic for handling HTTP requests:
1. Extract request data (params, body, query)
2. Validate input
3. Call service functions
4. Format and return responses
5. Handle errors

**Example:**
```typescript
import { Request, Response } from 'express';
import { logger } from '@shared/utils';
import { ResourceService } from '../../services/resourceService';

const resourceLogger = logger.child({ service: 'admin-backend', component: 'resource-controller' });

export async function handleGetResource(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const resource = await ResourceService.getById(id);
    
    if (!resource) {
      res.status(404).json({ error: 'Resource not found' });
      return;
    }
    
    res.json(resource);
  } catch (error: unknown) {
    resourceLogger.error('Error fetching resource', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to fetch resource' });
  }
}
```

**Guidelines:**
- One controller file per feature/resource
- Group related handlers together
- Use consistent error handling patterns
- Use structured logging with `logger.child()`
- Return early for error cases
- Use `Promise<void>` return type for async handlers

## Service Files

Services contain reusable business logic:
- Database operations
- External API calls
- Complex calculations
- State management

**Guidelines:**
- Services should be stateless when possible
- Use dependency injection for testability
- Keep services focused on a single responsibility

## Utilities

Utilities are helper functions that:
- Transform data
- Validate input
- Format output
- Provide common functionality

**Location:**
- Feature-specific utilities: `controllers/feature/utils/`
- Shared utilities: `utils/` or `shared/utils/`

## Service-Specific Structures

### admin/backend

**Structure:**
```
admin/backend/src/
├── routes/                    # Route definitions
│   ├── cloud.ts
│   ├── subscription.ts
│   ├── publicApi.ts
│   └── ...
├── controllers/               # Request handlers
│   ├── cloud/
│   │   ├── oauthController.ts
│   │   ├── integrationController.ts
│   │   ├── folderController.ts
│   │   ├── indexingController.ts
│   │   ├── weaviateController.ts
│   │   └── index.ts
│   ├── subscription/
│   │   ├── subscriptionInfoController.ts
│   │   ├── subscriptionTrialController.ts
│   │   ├── subscriptionCheckoutController.ts
│   │   ├── subscriptionManagementController.ts
│   │   ├── subscriptionUsageController.ts
│   │   └── index.ts
│   └── ...
├── services/                  # Business logic
├── middleware/               # Express middleware
└── lib/                      # Prisma client
```

**Refactored Files:**
- `cloud.ts`: 1,060 → 119 lines (~89% reduction)
- `dbBlock.ts`: 891 → 124 lines (~86% reduction)
- `slack.ts`: 1,084 → 63 lines (~94% reduction)
- `stripeWebhook.ts`: 737 → 11 lines (~98% reduction)
- `subscription.ts`: 689 → 56 lines (~92% reduction)
- `publicApi.ts`: 539 → 43 lines (~92% reduction)
- `apiDocs.ts`: 430 → 12 lines (~97% reduction)
- `documents.ts`: 419 → 17 lines (~96% reduction)
- `apiTokens.ts`: 335 → 43 lines (~87% reduction)

### instance-provisioning-service

**Structure:**
```
instance-provisioning-service/src/
├── routes/
│   ├── instances.ts
│   ├── templates.ts
│   └── health.ts
├── controllers/
│   ├── instances/
│   │   ├── instanceController.ts
│   │   └── index.ts
│   ├── templates/
│   │   ├── templateController.ts
│   │   └── index.ts
│   └── health/
│       ├── healthController.ts
│       └── index.ts
├── services/
│   ├── InstanceManager.ts
│   ├── DockerManager.ts
│   └── SubdomainManager.ts
└── types/
```

**Refactored Files:**
- `instances.ts`: 104 → 34 lines (~67% reduction)
- `templates.ts`: 82 → 30 lines (~63% reduction)
- `health.ts`: 56 → 18 lines (~68% reduction)

### cron-scheduler

**Structure:**
```
cron-scheduler/src/
├── routes/
│   └── cron.ts
├── controllers/
│   └── cron/
│       ├── cronController.ts
│       └── index.ts
├── cronScheduler.ts          # Service class
└── index.ts
```

**Refactored Files:**
- `index.ts`: 185 → 38 lines (~79% reduction)

### crawling-service

**Structure:**
```
crawling-service/src/
├── routes/
│   └── crawl.ts
├── controllers/
│   └── crawl/
│       ├── crawlController.ts
│       └── index.ts
├── crawling.ts               # Service class
├── optimized-crawling.ts     # Service class
└── index.ts
```

**Refactored Files:**
- `index.ts`: 171 → 18 lines (~89% reduction)

## Naming Conventions

### Files
- **Routes**: `kebab-case.ts` (e.g., `subscription.ts`, `api-tokens.ts`)
- **Controllers**: `camelCaseController.ts` (e.g., `subscriptionController.ts`)
- **Services**: `PascalCase.ts` (e.g., `StripeService.ts`, `InstanceManager.ts`)
- **Types**: `PascalCase.ts` (e.g., `InstanceConfig.ts`)
- **Utils**: `camelCaseUtils.ts` (e.g., `validationUtils.ts`)

### Functions
- **Controller handlers**: `handle<Action><Resource>` (e.g., `handleGetUser`, `handleCreateSubscription`)
- **Service methods**: `verbNoun` (e.g., `getUser`, `createSubscription`, `updateToken`)
- **Utilities**: `verbNoun` or descriptive name (e.g., `validateInput`, `formatDate`)

### Directories
- **Controllers**: Feature-based grouping (e.g., `controllers/subscription/`, `controllers/cloud/`)
- **Services**: Flat structure or feature-based if large
- **Routes**: Flat structure

## Best Practices

### 1. Error Handling
- Always use try-catch in controllers
- Return early for error cases
- Use structured logging
- Return appropriate HTTP status codes

### 2. Type Safety
- Use TypeScript types for all function parameters
- Avoid `any` types
- Use Prisma types from `@prisma/client`
- Define custom types in `types/` directory

### 3. Logging
- Use structured logging with `logger.child()`
- Include context in log messages (user ID, resource ID, etc.)
- Log errors with full error objects
- Use appropriate log levels (error, warn, info, debug)

### 4. Testing
- Write tests for controllers
- Mock services and external dependencies
- Test error cases
- Use consistent test structure

### 5. Code Organization
- Keep files focused and under 300 lines when possible
- Extract complex logic to services or utilities
- Group related functionality together
- Use index files for clean imports

## Migration Checklist

When refactoring existing code:

- [ ] Create `controllers/` directory structure
- [ ] Extract route handlers to controller files
- [ ] Update route files to delegate to controllers
- [ ] Extract utilities to `utils/` directories
- [ ] Update imports throughout the codebase
- [ ] Update tests to use new import paths
- [ ] Verify all tests pass
- [ ] Check build succeeds
- [ ] Update documentation

## Examples

See the refactored files in:
- `admin/backend/src/routes/` and `admin/backend/src/controllers/`
- `instance-provisioning-service/src/routes/` and `instance-provisioning-service/src/controllers/`
- `cron-scheduler/src/routes/` and `cron-scheduler/src/controllers/`
- `crawling-service/src/routes/` and `crawling-service/src/controllers/`

## Future Improvements

1. **Shared Controller Base**: Create a base controller class for common functionality
2. **Request Validation**: Standardize validation using a schema library (e.g., Zod)
3. **Response Formatting**: Create a standard response format utility
4. **Error Handling Middleware**: Centralize error handling in middleware
5. **API Documentation**: Auto-generate API docs from route/controller structure
