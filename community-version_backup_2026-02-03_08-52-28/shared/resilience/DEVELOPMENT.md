# Development Setup for Shared Resilience Library

## Local Development

When developing `admin-backend` locally, the import path `../../../shared/resilience` from `admin/backend/src/services/` won't resolve correctly because it points to `admin/backend/shared/resilience` (which doesn't exist).

### Option 1: Build the Shared Library First (Recommended)

1. Build the shared resilience library:
   ```bash
   cd shared/resilience
   npm install
   npm run build
   ```

2. Create a symlink in `admin/backend`:
   ```bash
   cd admin/backend
   ln -s ../../shared/resilience ./shared/resilience
   ```

3. Now the import `../../../shared/resilience` from `admin/backend/src/services/` will resolve to `admin/backend/shared/resilience` (symlink) → `shared/resilience` (actual).

### Option 2: Use Absolute Import (Not Recommended)

Modify imports to use `../../../../shared/resilience` for development, but this won't work at runtime.

### Option 3: Use Path Mapping with Runtime Resolver

1. Install `tsconfig-paths`:
   ```bash
   cd admin/backend
   npm install --save-dev tsconfig-paths
   ```

2. Update `tsconfig.json` to use path mapping:
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@shared/resilience": ["../../shared/resilience/src"]
       }
     }
   }
   ```

3. Update imports to use `@shared/resilience`

4. Register path resolver at runtime (in `index.ts`):
   ```typescript
   import 'tsconfig-paths/register';
   ```

However, this requires the shared library's source files to be available at runtime, which isn't ideal for production.

## Docker Build

The Docker build handles this correctly:
- Build context is project root
- Shared library is built first
- Files are copied to `/app/shared/resilience/` in the container
- Runtime path `../../../shared/resilience` from `/app/dist/services/` resolves to `/app/shared/resilience` ✓

## Recommended Approach

For local development, use **Option 1** (symlink). This matches the runtime structure and doesn't require additional dependencies.
