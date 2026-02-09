# User Backend Testing Roadmap

## Overview
This document outlines the testing strategy for the user-backend service, including current test coverage, gaps, and a roadmap for comprehensive testing.

## Current Test Coverage

### ✅ Completed Tests

#### Middleware (4/5)
- ✅ `adminAuth.test.ts` - Admin authentication middleware
- ✅ `apiAuth.test.ts` - API token authentication middleware
- ✅ `auth.test.ts` - User authentication middleware
- ✅ `corsApi.test.ts` - CORS API middleware
- ⚠️ `rateLimiter.test.ts` - Rate limiting middleware (exists but needs verification)

#### Controllers (3/3)
- ✅ `auth.test.ts` - Authentication controller (register, login, logout, getMe)
- ✅ `chat.test.ts` - Chat controller (respond, getHistory, getChatSessions, etc.)
- ✅ `chatbot.test.ts` - Chatbot controller (getChatbots, setDefaultChatbot, getChatbotById)

#### Routes (3/6)
- ✅ `calendarActions.test.ts` - Calendar action confirmation routes
- ✅ `mermaid.test.ts` - Mermaid diagram to image conversion
- ✅ `userOAuth.test.ts` - User OAuth routes
- ❌ `auth.ts` - Authentication routes (covered by controller tests)
- ❌ `chat.ts` - Chat routes (covered by controller tests)
- ❌ `chatbot.ts` - Chatbot routes (covered by controller tests)

#### Services (2/20+)
- ✅ `followUpGenerator.test.ts` - Follow-up question generation
- ✅ `llmService.test.ts` - LLM service (Gemini, OpenAI, Mistral, Anthropic)
- ❌ `apiTokenService.ts` - API token management
- ❌ `calendarActionAuditService.ts` - Calendar action audit logging
- ❌ `calendarActionConfirmationService.ts` - Calendar action confirmation
- ❌ `calendarActionDetectionService.ts` - Calendar action detection
- ❌ `calendarBlockExecutionService.ts` - Calendar block execution
- ❌ `calendarCacheService.ts` - Calendar caching
- ❌ `chatAnsweringService.ts` - Chat answering logic
- ❌ `cloudContextRetrievalService.ts` - Cloud context retrieval
- ❌ `contextRetrievalService.ts` - Context retrieval
- ❌ `dbBlockExecutionService.ts` - Database block execution
- ❌ `dbBlockHelper.ts` - Database block helpers
- ❌ `dbConnectionService.ts` - Database connection management
- ❌ `dbFileStorageService.ts` - Database file storage
- ❌ `dbQueryGenerator.ts` - Database query generation
- ❌ `dbQueryValidator.ts` - Database query validation
- ❌ `dbSchemaDiscovery.ts` - Database schema discovery
- ❌ `mermaidImageService.ts` - Mermaid image generation
- ❌ `userOAuthService.ts` - User OAuth service
- ❌ `vectorStore.ts` - Vector store operations
- ❌ Calendar providers (Google, CalDAV)
- ❌ Cloud providers (Google Drive, Nextcloud)
- ❌ Database drivers (MySQL, PostgreSQL, SQLite)
- ❌ Output formatters (API, Bubble, Chat, Slack)

#### Utils (1/6)
- ✅ `systemPromptGenerator.test.ts` - System prompt generation
- ❌ `aiCallTracking.ts` - AI call tracking
- ❌ `credentialEncryption.ts` - Credential encryption
- ❌ `dbResultFormatter.ts` - Database result formatting
- ❌ `mermaidUtils.ts` - Mermaid utilities
- ❌ `tokenEncryption.ts` - Token encryption

## Testing Patterns & Best Practices

### Mocking Strategy
1. **Prisma Mocking**: Use `vi.hoisted()` for mocks used in `vi.mock()` to avoid hoisting issues
2. **Service Mocking**: Mock external services (LLM APIs, OAuth providers) using `vi.hoisted()`
3. **Module Mocking**: Always mock `lib/prisma` in addition to `@prisma/client`

### Example Pattern
```typescript
// Use vi.hoisted() for mocks used in vi.mock()
const { mockService } = vi.hoisted(() => {
  const mockService = {
    method: vi.fn(),
  };
  return { mockService };
});

vi.mock('../../services/myService', () => ({
  method: mockService.method,
}));
```

### Test Structure
```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Method Name', () => {
    it('should handle success case', async () => {
      // Arrange
      mockPrisma.model.findUnique.mockResolvedValue(mockData);
      
      // Act
      const result = await functionUnderTest();
      
      // Assert
      expect(result).toBeDefined();
      expect(mockPrisma.model.findUnique).toHaveBeenCalled();
    });

    it('should handle error case', async () => {
      // Arrange
      mockPrisma.model.findUnique.mockRejectedValue(new Error('Error'));
      
      // Act & Assert
      await expect(functionUnderTest()).rejects.toThrow();
    });
  });
});
```

## Priority Testing Roadmap

### Phase 1: Critical Services (High Priority)
**Goal**: Ensure core functionality is tested

1. **apiTokenService.ts** (Priority: HIGH)
   - Token creation, validation, expiration
   - Usage tracking and limits
   - Token revocation

2. **userOAuthService.ts** (Priority: HIGH)
   - OAuth URL generation
   - Token exchange
   - CalDAV credential storage
   - Connection management

3. **chatAnsweringService.ts** (Priority: HIGH)
   - Message processing
   - Context retrieval
   - Response generation
   - Error handling

4. **dbBlockExecutionService.ts** (Priority: HIGH)
   - Database query execution
   - Result formatting
   - Error handling
   - Security validation

### Phase 2: Calendar Services (Medium Priority)
**Goal**: Ensure calendar integration works correctly

5. **calendarBlockExecutionService.ts**
   - Event creation
   - Event updates
   - Event deletion
   - OAuth flow integration

6. **calendarActionConfirmationService.ts**
   - Action storage
   - Token generation/validation
   - Action retrieval

7. **calendarActionAuditService.ts**
   - Action logging
   - Audit trail

8. **Calendar Providers** (googleCalendarProvider.ts, caldavProvider.ts)
   - Provider-specific operations
   - Error handling
   - OAuth integration

### Phase 3: Database Services (Medium Priority)
**Goal**: Ensure database operations are secure and correct

9. **dbQueryGenerator.ts**
   - Query generation
   - Parameter binding
   - SQL injection prevention

10. **dbQueryValidator.ts**
    - Query validation
    - Security checks
    - Permission validation

11. **dbSchemaDiscovery.ts**
    - Schema discovery
    - Table/column detection

12. **Database Drivers** (mysqlDriver.ts, postgresqlDriver.ts, sqliteDriver.ts)
    - Connection management
    - Query execution
    - Error handling

### Phase 4: Cloud Services (Low Priority)
**Goal**: Ensure cloud integrations work

13. **cloudContextRetrievalService.ts**
    - Context retrieval
    - File access
    - Permission checks

14. **Cloud Providers** (googleDriveProvider.ts, nextcloudProvider.ts)
    - Provider-specific operations
    - OAuth integration

### Phase 5: Utility Services (Low Priority)
**Goal**: Ensure utilities work correctly

15. **mermaidImageService.ts**
    - Image generation
    - Error handling

16. **vectorStore.ts**
    - Vector operations
    - Search functionality

17. **Utils** (credentialEncryption.ts, tokenEncryption.ts, etc.)
    - Encryption/decryption
    - Security validation

## Test Coverage Goals

### Current Status
- **Middleware**: ~80% (4/5)
- **Controllers**: 100% (3/3)
- **Routes**: ~50% (3/6, but controllers cover most)
- **Services**: ~10% (2/20+)
- **Utils**: ~17% (1/6)

### Target Goals
- **Overall Coverage**: 80%+
- **Critical Services**: 90%+
- **Middleware**: 100%
- **Controllers**: 100%
- **Services**: 75%+

## Testing Checklist

### For Each New Test File

- [ ] Mock Prisma using `vi.hoisted()` pattern
- [ ] Mock external services (LLM, OAuth, etc.)
- [ ] Test success cases
- [ ] Test error cases
- [ ] Test edge cases
- [ ] Test input validation
- [ ] Test security (SQL injection, XSS, etc.)
- [ ] Use helper functions from `helpers.ts`
- [ ] Clear mocks in `beforeEach`
- [ ] Follow naming conventions

### For Each Service Test

- [ ] Test all public methods
- [ ] Test error handling
- [ ] Test edge cases (null, undefined, empty)
- [ ] Test with invalid inputs
- [ ] Test integration with dependencies
- [ ] Mock external API calls
- [ ] Test timeout scenarios
- [ ] Test retry logic (if applicable)

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/__tests__/services/apiTokenService.test.ts
```

## Common Issues & Solutions

### Issue: "mockPrisma is not a constructor"
**Solution**: Ensure `lib/prisma` is mocked in addition to `@prisma/client`

### Issue: "Cannot access 'mockX' before initialization"
**Solution**: Use `vi.hoisted()` for mocks used in `vi.mock()`

### Issue: Tests failing due to missing Prisma models
**Solution**: Add missing models to `mockPrisma` in `setup.ts`

### Issue: External API calls in tests
**Solution**: Mock all external API calls (fetch, HTTP clients, etc.)

## References

- Admin Backend Tests: `/admin/backend/src/__tests__/` (fully tested, use as reference)
- Vitest Documentation: https://vitest.dev/
- Prisma Testing: https://www.prisma.io/docs/guides/testing

## Notes

- All tests should be isolated and not depend on external services
- Use mocks for all database operations
- Use mocks for all external API calls
- Test files should be co-located with source files in `__tests__` directories
- Follow the existing test patterns from admin-backend
