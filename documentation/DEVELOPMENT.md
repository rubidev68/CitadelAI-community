# Development Guide

This comprehensive development guide covers everything needed to contribute to the CitadelAI platform, from initial setup to advanced development practices.

## 🎯 **Choose Your Development Edition**

CitadelAI supports development for both Community and Business editions:

### 🆓 **Community Edition Development**
- **Branch**: `opensource-dev`
- **Focus**: Open-source features and community contributions
- **Deployment**: `docker-compose.opensource.yml`
- **Documentation**: [Community Edition Guide](./COMMUNITY_EDITION.md)

### 💼 **Business Edition Development**
- **Branch**: `dev`
- **Focus**: Enterprise features and proprietary development
- **Deployment**: `docker-compose.yml` or `docker-compose.local.yml`
- **Documentation**: [Business Edition Guide](./BUSINESS_EDITION.md)

> 📖 **For detailed comparison**: See [Edition Comparison Guide](./EDITION_COMPARISON.md)

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Debugging](#debugging)
- [Performance](#performance)
- [Contributing](#contributing)
- [Release Process](#release-process)

## Getting Started

### Prerequisites

**Required Software**:
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **Docker**: >= 20.0.0
- **Docker Compose**: >= 2.0.0
- **Git**: Latest version

**Recommended Software**:
- **VS Code**: With recommended extensions
- **Postman**: For API testing
- **DBeaver**: For database management
- **Redis Commander**: For Redis management

### Initial Setup

1. **Clone Repository**:
```bash
git clone https://github.com/citadelai/citadelai.git
cd citadelai
```

2. **Choose Your Edition**:
```bash
# For Community Edition development
git checkout opensource-dev

# For Business Edition development
git checkout dev
```

3. **Install Dependencies**:
```bash
# Frontend dependencies
cd admin/interface && npm install
cd user/interface && npm install

# Backend dependencies
cd admin/backend && npm install
cd user/backend && npm install
cd crawling-service && npm install
cd cron-scheduler && npm install

# Business Edition additional dependencies
cd adminjs-dashboard && npm install
```

4. **Environment Setup**:
```bash
# Copy environment files
cp .env.example .env
cp .env.proprietary.example .env.proprietary

# Edit .env with your configuration
# For Business Edition, also configure .env.proprietary
# At minimum, add at least one AI provider API key:
# GEMINI_API_KEY=your_gemini_api_key_here
# OPENAI_API_KEY=your_openai_api_key_here
# ANTHROPIC_API_KEY=your_anthropic_api_key_here
# MISTRAL_API_KEY=your_mistral_api_key_here
```

4. **Start Development Environment**:
```bash
# Start databases and external services
docker-compose up db weaviate -d

# Start all services in development mode
npm run dev
```

5. **Verify Setup**:
```bash
# Check all services are running
curl http://localhost:3003/health  # User Service
curl http://localhost:3002/health  # Admin Service
curl http://localhost:3001/health  # Crawling Service
curl http://localhost:3004/health  # Cron Scheduler

# Check frontend applications
open http://localhost:8080  # User Interface
open http://localhost:8081  # Admin Interface
```

## Development Environment

### Service-Specific Development

**User Service**:
```bash
cd user/backend
npm install
npm run dev
```

**Admin Service**:
```bash
cd admin/backend
npm install
npm run dev
```

**Crawling Service**:
```bash
cd crawling-service
npm install
npm run dev
```

**Cron Scheduler**:
```bash
cd cron-scheduler
npm install
npm run dev
```

**User Frontend**:
```bash
cd user/interface
npm install
npm run dev
```

**Admin Frontend**:
```bash
cd admin/interface
npm install
npm run dev
```

### Database Setup

**PostgreSQL**:
```bash
# Start PostgreSQL
docker-compose up db -d

# Connect to database
docker exec -it citadel-ai-db psql -U citadel_user -d citadel_db

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Seed database (optional)
npx prisma db seed
```

**Weaviate**:
```bash
# Start Weaviate
docker-compose up weaviate -d

# Check Weaviate health
curl http://localhost:8082/v1/meta

# Create schema (if needed)
curl -X POST http://localhost:8082/v1/schema \
  -H "Content-Type: application/json" \
  -d @weaviate-schema.json
```

### Environment Variables

**Development Configuration**:
```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://citadel_user:citadel_pass@localhost:5432/citadel_db

# External Services
OPENAI_API_KEY=your_openai_api_key_here
WEAVIATE_URL=http://localhost:8082

# Service URLs
CRAWLING_SERVICE_URL=http://localhost:3001
CRON_SCHEDULER_URL=http://localhost:3004

# JWT Configuration
JWT_SECRET=development_secret_key

# Development Settings
DEBUG=true
HOT_RELOAD=true
```

## Project Structure

### Root Directory

```
CitadelAI/
├── user/                    # User-facing application
│   ├── backend/            # User service (Node.js + Express)
│   └── interface/          # User frontend (React + TypeScript)
├── admin/                  # Admin-facing application
│   ├── backend/            # Admin service (Node.js + Express)
│   └── interface/          # Admin frontend (React + TypeScript)
├── crawling-service/       # Web crawling service
├── cron-scheduler/         # Scheduled crawling service
├── documentation/          # Comprehensive documentation
├── scripts/               # Utility scripts
├── tests/                 # Integration tests
├── docker-compose.yml     # Development environment
├── package.json           # Root package configuration
└── README.md              # Project overview
```

### Service Structure

**Backend Service Structure**:
```
service-name/
├── src/                    # Source code
│   ├── controllers/        # Request handlers
│   ├── services/          # Business logic
│   ├── middleware/        # Express middleware
│   ├── routes/            # API routes
│   ├── models/            # Data models
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript types
│   └── index.ts           # Entry point
├── prisma/                # Database schema and migrations
├── tests/                 # Unit and integration tests
├── dist/                  # Compiled JavaScript
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── Dockerfile             # Container configuration
└── README.md              # Service documentation
```

**Frontend Service Structure**:
```
interface/
├── src/                    # Source code
│   ├── components/        # React components
│   ├── pages/             # Page components
│   ├── hooks/             # Custom React hooks
│   ├── contexts/          # React contexts
│   ├── services/          # API services
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript types
│   ├── styles/            # CSS and styling
│   └── main.tsx           # Entry point
├── public/                # Static assets
├── dist/                  # Built application
├── package.json           # Dependencies and scripts
├── vite.config.ts         # Vite configuration
├── Dockerfile             # Container configuration
└── README.md              # Service documentation
```

### Code Organization

**Controller Pattern**:
```typescript
// controllers/auth.ts
export class AuthController {
  async register(req: Request, res: Response) {
    // Registration logic
  }
  
  async login(req: Request, res: Response) {
    // Login logic
  }
}
```

**Service Pattern**:
```typescript
// services/authService.ts
export class AuthService {
  async createUser(userData: CreateUserData): Promise<User> {
    // User creation logic
  }
  
  async validateCredentials(email: string, password: string): Promise<User | null> {
    // Credential validation logic
  }
}
```

**Repository Pattern**:
```typescript
// repositories/userRepository.ts
export class UserRepository {
  async findById(id: string): Promise<User | null> {
    // Database query logic
  }
  
  async create(userData: CreateUserData): Promise<User> {
    // Database creation logic
  }
}
```

## Code Standards

### TypeScript Configuration

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### ESLint Configuration

**eslint.config.js**:
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/prefer-const': 'error',
    '@typescript-eslint/no-var-requires': 'error'
  },
  env: {
    node: true,
    es6: true
  }
};
```

### Prettier Configuration

**.prettierrc**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

### Code Style Guidelines

**Naming Conventions**:
```typescript
// Variables and functions: camelCase
const userName = 'john_doe';
const getUserById = (id: string) => {};

// Classes: PascalCase
class UserService {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// Interfaces: PascalCase with 'I' prefix
interface IUserRepository {}

// Types: PascalCase
type UserRole = 'admin' | 'user';

// Enums: PascalCase
enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}
```

**File Organization**:
```typescript
// 1. Imports (external libraries first)
import express from 'express';
import { PrismaClient } from '@prisma/client';

// 2. Internal imports
import { AuthService } from '../services/authService';
import { UserRepository } from '../repositories/userRepository';

// 3. Type definitions
interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}

// 4. Constants
const MAX_USERS_PER_PAGE = 50;

// 5. Main code
export class UserController {
  // Implementation
}
```

**Error Handling**:
```typescript
// Use custom error classes
export class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Handle errors consistently
export const handleError = (error: Error, res: Response) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: error.message,
      field: error.field
    });
  }
  
  console.error('Unexpected error:', error);
  return res.status(500).json({
    error: 'Internal server error'
  });
};
```

## Testing

### Test Structure

**Unit Tests**:
```typescript
// tests/unit/authService.test.ts
import { AuthService } from '../../src/services/authService';
import { UserRepository } from '../../src/repositories/userRepository';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      create: jest.fn()
    } as any;
    
    authService = new AuthService(mockUserRepository);
  });

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };
      
      mockUserRepository.create.mockResolvedValue({
        id: '1',
        ...userData,
        createdAt: new Date()
      });

      // Act
      const result = await authService.createUser(userData);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(userData.email);
      expect(mockUserRepository.create).toHaveBeenCalledWith(userData);
    });

    it('should throw error if user already exists', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };
      
      mockUserRepository.findByEmail.mockResolvedValue({
        id: '1',
        ...userData,
        createdAt: new Date()
      });

      // Act & Assert
      await expect(authService.createUser(userData))
        .rejects
        .toThrow('User already exists');
    });
  });
});
```

**Integration Tests**:
```typescript
// tests/integration/auth.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { PrismaClient } from '@prisma/client';

describe('Auth API', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
    });

    it('should return error for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });
});
```

**E2E Tests**:
```typescript
// tests/e2e/user-flow.test.ts
import { test, expect } from '@playwright/test';

test.describe('User Flow', () => {
  test('should complete user registration and login flow', async ({ page }) => {
    // Navigate to registration page
    await page.goto('http://localhost:8080/register');
    
    // Fill registration form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.fill('[data-testid="name-input"]', 'Test User');
    
    // Submit form
    await page.click('[data-testid="register-button"]');
    
    // Should redirect to login page
    await expect(page).toHaveURL('http://localhost:8080/login');
    
    // Fill login form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    
    // Submit form
    await page.click('[data-testid="login-button"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('http://localhost:8080/dashboard');
  });
});
```

### Test Commands

**Running Tests**:
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests only
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests for specific service
npm run test:user-backend
npm run test:admin-backend
npm run test:crawling-service
```

**Test Configuration**:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*'
      ]
    }
  }
});
```

## Debugging

### VS Code Configuration

**launch.json**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug User Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/user/backend/src/index.ts",
      "cwd": "${workspaceFolder}/user/backend",
      "env": {
        "NODE_ENV": "development",
        "DATABASE_URL": "postgresql://citadel_user:citadel_pass@localhost:5432/citadel_db"
      },
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Admin Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/admin/backend/src/index.ts",
      "cwd": "${workspaceFolder}/admin/backend",
      "env": {
        "NODE_ENV": "development",
        "DATABASE_URL": "postgresql://citadel_user:citadel_pass@localhost:5432/citadel_db"
      },
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Debugging Tools

**Console Logging**:
```typescript
// Use structured logging
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Use logger instead of console.log
logger.info('User created', { userId: user.id, email: user.email });
logger.error('Database error', { error: error.message, stack: error.stack });
```

**Debug Middleware**:
```typescript
// Debug middleware for Express
export const debugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`${req.method} ${req.url}`, {
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers
    });
  }
  next();
};
```

**Database Debugging**:
```typescript
// Enable Prisma query logging
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Params: ' + e.params);
  console.log('Duration: ' + e.duration + 'ms');
});
```

## Performance

### Performance Monitoring

**Performance Metrics**:
```typescript
// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.url} - ${duration}ms`);
    }
  });
  
  next();
};
```

**Memory Monitoring**:
```typescript
// Memory usage monitoring
export const memoryMonitor = () => {
  const usage = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(usage.external / 1024 / 1024)} MB`
  });
};

// Monitor memory every 30 seconds
setInterval(memoryMonitor, 30000);
```

### Optimization Techniques

**Database Optimization**:
```typescript
// Use connection pooling
import { Pool } from 'pg';

const pool = new Pool({
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds
});

// Use prepared statements
const getUserById = async (id: string) => {
  const query = 'SELECT * FROM users WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};
```

**Caching**:
```typescript
// Simple in-memory cache
class Cache {
  private cache = new Map<string, { value: any; expiry: number }>();
  
  set(key: string, value: any, ttl: number = 300000) { // 5 minutes default
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }
  
  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
}

const cache = new Cache();

// Use cache in service
export class UserService {
  async getUserById(id: string) {
    const cached = cache.get(`user:${id}`);
    if (cached) return cached;
    
    const user = await this.userRepository.findById(id);
    if (user) {
      cache.set(`user:${id}`, user);
    }
    
    return user;
  }
}
```

## Contributing

### Development Workflow

1. **Fork Repository**:
```bash
git clone https://github.com/rubidev68/CitadelAI.git
cd CitadelAI
```

2. **Create Feature Branch**:
```bash
git checkout -b feature/amazing-feature
```

3. **Make Changes**:
```bash
# Make your changes
# Write tests
# Update documentation
```

4. **Run Tests**:
```bash
npm test
npm run lint
npm run build
```

5. **Commit Changes**:
```bash
git add .
git commit -m "feat: add amazing feature"
```

6. **Push Changes**:
```bash
git push origin feature/amazing-feature
```

7. **Create Pull Request**:
- Go to GitHub repository
- Click "New Pull Request"
- Select your feature branch
- Fill out the PR template
- Submit for review

### Commit Message Convention

**Format**: `<type>(<scope>): <description>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build process or auxiliary tool changes

**Examples**:
```bash
feat(auth): add JWT token refresh
fix(crawling): resolve memory leak in batch processing
docs(api): update endpoint documentation
test(user): add integration tests for user service
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes
```

### Code Review Guidelines

**For Authors**:
- Keep PRs small and focused
- Write clear commit messages
- Include tests for new features
- Update documentation
- Respond to review feedback

**For Reviewers**:
- Check code quality and style
- Verify tests are adequate
- Ensure documentation is updated
- Test the changes locally
- Provide constructive feedback

## Release Process

### Version Management

**Semantic Versioning**:
- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes, backward compatible

**Version Bumping**:
```bash
# Patch version
npm version patch

# Minor version
npm version minor

# Major version
npm version major
```

### Release Checklist

**Pre-Release**:
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Version bumped
- [ ] Changelog updated
- [ ] Security scan completed

**Release**:
- [ ] Create release tag
- [ ] Build Docker images
- [ ] Deploy to staging
- [ ] Run smoke tests
- [ ] Deploy to production

**Post-Release**:
- [ ] Monitor deployment
- [ ] Verify functionality
- [ ] Update documentation
- [ ] Notify stakeholders

### Automated Release

**GitHub Actions Workflow**:
```yaml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build
        run: npm run build
        
      - name: Build Docker images
        run: |
          docker build -t citadel-ai/user-service:${{ github.ref_name }} ./user/backend
          docker build -t citadel-ai/admin-service:${{ github.ref_name }} ./admin/backend
          docker build -t citadel-ai/crawling-service:${{ github.ref_name }} ./crawling-service
          docker build -t citadel-ai/cron-scheduler:${{ github.ref_name }} ./cron-scheduler
          
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push citadel-ai/user-service:${{ github.ref_name }}
          docker push citadel-ai/admin-service:${{ github.ref_name }}
          docker push citadel-ai/crawling-service:${{ github.ref_name }}
          docker push citadel-ai/cron-scheduler:${{ github.ref_name }}
```

---

*This development guide is maintained alongside the codebase and reflects the current state of the CitadelAI platform. For specific implementation details, refer to the individual service documentation.*