# Test Coverage Improvement Plan

## Current Status
- **Overall Coverage**: 28.85% statements, 20.93% branches, 23.23% functions, 28.94% lines
- **Target**: 60% functions coverage (currently at 23.23%)
- **Test Files**: 25 passed, 1 skipped (26 total)
- **Tests**: 475 passed, 7 skipped (482 total)

## Priority Areas

### Phase 1: Critical Routes (High Impact, Low Coverage)
**Goal**: Bring all routes to at least 70% coverage

#### 1.1 `widget.ts` (0% coverage)
- **Priority**: HIGH
- **Lines**: 15-1857 (entire file untested)
- **Estimated Tests**: 50-80 tests
- **Focus Areas**:
  - Widget configuration endpoints
  - Widget rendering logic
  - Widget data fetching
  - Error handling
  - Authentication/authorization

#### 1.2 `cloud.ts` (26.18% coverage)
- **Priority**: HIGH
- **Uncovered Lines**: 157-265, 293, 298, 311-313, 337, 342, 349-351, 360-475, 484-622, 631-700, 709-826, 835-877, 890, 905, 910, 916, 926, 936-944, 956-1016, 1025-1059
- **Estimated Tests**: 40-60 tests
- **Focus Areas**:
  - Cloud provider integration (Google Drive, OneDrive, Nextcloud)
  - OAuth flows
  - File indexing
  - Error handling for cloud services
  - Authentication flows

#### 1.3 `slack.ts` (38.54% coverage)
- **Priority**: HIGH
- **Uncovered Lines**: 157-294, 308, 311, 332, 334, 336, 342-354, 369, 373, 404-508, 520-882, 908, 922, 936-938, 977, 984-986, 1019, 1026, 1039-1041, 1073, 1080, 1086-1088
- **Estimated Tests**: 50-70 tests
- **Focus Areas**:
  - Slack OAuth integration
  - Webhook handling
  - Message processing
  - Event handling
  - Error scenarios

#### 1.4 `documents.ts` (32.23% coverage)
- **Priority**: MEDIUM
- **Uncovered Lines**: 31-32, 43-46, 59, 63, 139-151, 177, 202-414
- **Estimated Tests**: 20-30 tests
- **Focus Areas**:
  - PDF parsing error handling
  - Weaviate connection errors
  - Vectorization fallback logic
  - File upload validation
  - Schema creation errors

#### 1.5 `dbBlock.ts` (46.83% coverage)
- **Priority**: MEDIUM
- **Uncovered Lines**: 39-44, 303, 405, 459-460, 472-474, 490-619, 635-719, 735-791, 806-881
- **Estimated Tests**: 30-40 tests
- **Focus Areas**:
  - File upload handling (SQLite files)
  - Database file storage
  - Internal service endpoints
  - Error handling in file operations

#### 1.6 `publicApi.ts` (72.83% coverage)
- **Priority**: LOW
- **Uncovered Lines**: 18, 57-84, 94-96, 111-123, 138, 149, 154, 162, 169, 188, 206-208, 320-323, 347-349, 448-453, 458-463, 478, 498-499
- **Estimated Tests**: 15-25 tests
- **Focus Areas**:
  - Edge cases in API responses
  - Error handling
  - Rate limiting scenarios
  - Authentication edge cases

### Phase 2: Service Layer (Critical for Overall Coverage)
**Goal**: Bring all services to at least 50% coverage

#### 2.1 High-Priority Services (0% coverage, frequently used)
- **`stripeService.ts`** (0% coverage, 5-435 lines)
  - Estimated Tests: 30-50 tests
  - Focus: Payment processing, webhooks, subscription management
  
- **`zoho-email.ts`** (0% coverage, 9-1136 lines)
  - Estimated Tests: 40-60 tests
  - Focus: Email sending, template handling, error recovery
  
- **`slackApiClient.ts`** (0% coverage, 49-637 lines)
  - Estimated Tests: 30-40 tests
  - Focus: API calls, error handling, rate limiting
  
- **`slackMessageProcessor.ts`** (0% coverage, 22-899 lines)
  - Estimated Tests: 40-50 tests
  - Focus: Message parsing, event handling, state management
  
- **`slackOAuthService.ts`** (0% coverage, 6-340 lines)
  - Estimated Tests: 20-30 tests
  - Focus: OAuth flows, token management, error handling

#### 2.2 Database Services (0% coverage)
- **`dbConnectionService.ts`** (0% coverage, 48-199 lines)
  - Estimated Tests: 25-35 tests
  - Focus: Connection management, query execution, error handling
  
- **`dbQueryValidator.ts`** (0% coverage, 15-99 lines)
  - Estimated Tests: 15-20 tests
  - Focus: SQL validation, security checks
  
- **`dbQueryGenerator.ts`** (0% coverage, 19-119 lines)
  - Estimated Tests: 15-20 tests
  - Focus: Query generation logic
  
- **`dbSchemaDiscovery.ts`** (0% coverage, 65-557 lines)
  - Estimated Tests: 30-40 tests
  - Focus: Schema detection, table/column discovery
  
- **`dbBlockExecutionService.ts`** (0% coverage, 33-68 lines)
  - Estimated Tests: 10-15 tests
  - Focus: Block execution logic
  
- **`dbFileStorageService.ts`** (0% coverage, 33-298 lines)
  - Estimated Tests: 20-30 tests
  - Focus: File storage, retrieval, deletion

#### 2.3 Cloud Services (0% coverage)
- **`cloudIndexingService.ts`** (0% coverage, 16-851 lines)
  - Estimated Tests: 40-50 tests
  - Focus: File indexing, sync logic, error handling
  
- **`cloudIntegrationService.ts`** (0% coverage, 53-162 lines)
  - Estimated Tests: 15-20 tests
  - Focus: Integration management
  
- **`cloudOAuthService.ts`** (0% coverage, 12-330 lines)
  - Estimated Tests: 20-30 tests
  - Focus: OAuth flows for cloud providers

#### 2.4 Other Services (0% coverage)
- **`apiTokenService.ts`** (0% coverage, 11-156 lines)
  - Estimated Tests: 15-20 tests
  - Focus: Token generation, validation, revocation
  
- **`emailServiceClient.ts`** (0% coverage, 31-115 lines)
  - Estimated Tests: 10-15 tests
  - Focus: Email client operations
  
- **`passwordResetService.ts`** (0% coverage, 14-75 lines)
  - Estimated Tests: 10-15 tests
  - Focus: Password reset flows
  
- **`twoFactorService.ts`** (0% coverage, 14-145 lines)
  - Estimated Tests: 15-20 tests
  - Focus: 2FA generation, validation
  
- **`subscriptionUsageCache.ts`** (0% coverage, 21-121 lines)
  - Estimated Tests: 10-15 tests
  - Focus: Cache operations, usage tracking

### Phase 3: Middleware Improvements
**Goal**: Bring all middleware to 95%+ coverage

#### 3.1 `corsApi.ts` (88.23% coverage)
- **Uncovered Lines**: 103-104, 122-123, 149-150, 160-164
- **Estimated Tests**: 5-8 tests
- **Focus**: Edge cases in CORS handling

#### 3.2 `subscriptionMiddleware.ts` (84.9% coverage)
- **Uncovered Lines**: 53, 117-118, 135, 163-164, 206, 211-212, 268-278
- **Estimated Tests**: 8-12 tests
- **Focus**: Subscription limit checks, error scenarios

#### 3.3 `apiAuth.ts` (94.87% coverage)
- **Uncovered Lines**: 100, 127
- **Estimated Tests**: 2-3 tests
- **Focus**: Edge cases in API authentication

### Phase 4: Utility Functions
**Goal**: Bring all utilities to at least 70% coverage

- **`credentialEncryption.ts`** (0% coverage, 3-55 lines)
  - Estimated Tests: 8-12 tests
  - Focus: Encryption/decryption logic
  
- **`dbResultFormatter.ts`** (0% coverage, 16-110 lines)
  - Estimated Tests: 15-20 tests
  - Focus: Result formatting, edge cases
  
- **`subscriptionLimits.ts`** (0% coverage, 9-228 lines)
  - Estimated Tests: 20-30 tests
  - Focus: Limit calculations, validation

### Phase 5: Database Drivers
**Goal**: Basic coverage for all database drivers

- **`mysqlDriver.ts`** (0% coverage, 18-192 lines)
  - Estimated Tests: 20-25 tests
  
- **`postgresqlDriver.ts`** (0% coverage, 18-173 lines)
  - Estimated Tests: 20-25 tests
  
- **`sqliteDriver.ts`** (0% coverage, 30-183 lines)
  - Estimated Tests: 20-25 tests

## Implementation Strategy

### Week 1-2: Critical Routes
1. **Day 1-3**: `widget.ts` (0% → 70%+)
2. **Day 4-6**: `cloud.ts` (26.18% → 70%+)
3. **Day 7-10**: `slack.ts` (38.54% → 70%+)
4. **Day 11-12**: `documents.ts` (32.23% → 70%+)
5. **Day 13-14**: `dbBlock.ts` (46.83% → 70%+)

### Week 3-4: High-Priority Services
1. **Day 1-3**: `stripeService.ts` (0% → 60%+)
2. **Day 4-6**: `zoho-email.ts` (0% → 60%+)
3. **Day 7-9**: `slackApiClient.ts` (0% → 60%+)
4. **Day 10-12**: `slackMessageProcessor.ts` (0% → 60%+)
5. **Day 13-14**: `slackOAuthService.ts` (0% → 60%+)

### Week 5-6: Database Services
1. **Day 1-3**: `dbConnectionService.ts` (0% → 60%+)
2. **Day 4-5**: `dbQueryValidator.ts` (0% → 80%+)
3. **Day 6-7**: `dbQueryGenerator.ts` (0% → 80%+)
4. **Day 8-11**: `dbSchemaDiscovery.ts` (0% → 60%+)
5. **Day 12-13**: `dbBlockExecutionService.ts` (0% → 80%+)
6. **Day 14**: `dbFileStorageService.ts` (0% → 60%+)

### Week 7-8: Cloud Services & Remaining Services
1. **Day 1-4**: `cloudIndexingService.ts` (0% → 60%+)
2. **Day 5-6**: `cloudIntegrationService.ts` (0% → 60%+)
3. **Day 7-9**: `cloudOAuthService.ts` (0% → 60%+)
4. **Day 10-11**: `apiTokenService.ts` (0% → 70%+)
5. **Day 12-13**: `emailServiceClient.ts` (0% → 70%+)
6. **Day 14**: `passwordResetService.ts`, `twoFactorService.ts`, `subscriptionUsageCache.ts` (0% → 70%+)

### Week 9: Middleware & Utilities
1. **Day 1-2**: Complete middleware coverage (95%+)
2. **Day 3-5**: Utility functions (70%+)
3. **Day 6-7**: Database drivers (basic coverage)

### Week 10: Polish & Integration Tests
1. **Day 1-3**: Add integration tests for critical flows
2. **Day 4-5**: Review and improve existing tests
3. **Day 6-7**: Final coverage audit and gap filling

## Testing Best Practices

### 1. Test Structure
- Use `describe` blocks for logical grouping
- One `it` test per scenario
- Clear, descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Mocking Strategy
- Use `vi.hoisted()` for complex mocks
- Mock external dependencies (Prisma, Stripe, etc.)
- Mock file system operations
- Mock network requests (axios, fetch)

### 3. Coverage Goals
- **Routes**: Minimum 70% coverage, target 85%+
- **Services**: Minimum 60% coverage, target 75%+
- **Middleware**: Minimum 95% coverage
- **Utilities**: Minimum 70% coverage

### 4. Test Types
- **Unit Tests**: Individual functions/methods
- **Integration Tests**: Multiple components working together
- **Error Handling**: All error paths covered
- **Edge Cases**: Boundary conditions, null checks, empty inputs

### 5. Common Patterns
```typescript
// Error handling test pattern
it('should handle [specific error]', async () => {
  mockService.method.mockRejectedValue(new Error('Error message'));
  const response = await request(app).post('/endpoint').expect(500);
  expect(response.body.error).toBeDefined();
});

// Success path test pattern
it('should [expected behavior]', async () => {
  mockService.method.mockResolvedValue(mockData);
  const response = await request(app).post('/endpoint').expect(200);
  expect(response.body).toMatchObject(expectedResponse);
});

// Validation test pattern
it('should return 400 if [required field] is missing', async () => {
  const response = await request(app).post('/endpoint').send({}).expect(400);
  expect(response.body.error).toContain('[required field]');
});
```

## Success Metrics

### Short-term (4 weeks)
- Overall coverage: 28.85% → 45%+
- Functions coverage: 23.23% → 40%+
- All critical routes: 70%+ coverage
- High-priority services: 60%+ coverage

### Medium-term (8 weeks)
- Overall coverage: 45% → 60%+
- Functions coverage: 40% → 60%+ (meet threshold)
- All routes: 70%+ coverage
- All services: 60%+ coverage

### Long-term (10 weeks)
- Overall coverage: 60% → 75%+
- Functions coverage: 60% → 75%+
- All routes: 85%+ coverage
- All services: 75%+ coverage
- Middleware: 95%+ coverage

## Tools & Commands

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- <file>.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Coverage Analysis
```bash
# Generate coverage report
npm test -- --coverage

# View coverage in browser
open coverage/index.html
```

## Notes

1. **Incremental Approach**: Focus on one file at a time, ensure tests pass before moving on
2. **Test Quality**: Prioritize meaningful tests over just hitting coverage numbers
3. **Maintainability**: Write tests that are easy to understand and maintain
4. **CI/CD Integration**: Ensure all tests pass in CI/CD pipeline
5. **Documentation**: Update test documentation as new patterns emerge

## Estimated Total Tests

- **Phase 1 (Routes)**: ~200-300 tests
- **Phase 2 (Services)**: ~350-450 tests
- **Phase 3 (Middleware)**: ~15-25 tests
- **Phase 4 (Utilities)**: ~50-70 tests
- **Phase 5 (Drivers)**: ~60-75 tests
- **Total**: ~675-920 new tests

**Current**: 475 tests
**Target**: 1,150-1,395 tests
**Increase**: ~140-190% more tests
