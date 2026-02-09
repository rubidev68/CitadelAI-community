# Coverage Roadmap - Reaching 50% Threshold

## Current Status
- **Lines**: 19.97% (need **50%** - need +30.03%)
- **Statements**: 19.67% (need **50%** - need +30.33%)
- **Functions**: 25.74% (need **50%** - need +24.26%)
- **Branches**: 13.02% (need **60%** - need +46.98%)

## Strategy

To reach 50% coverage, we need to focus on **high-impact files** - those with many lines that are currently at 0% coverage. Each file tested will significantly move the needle.

### Impact Calculation
Files are prioritized by: `Lines × (1 - Current Coverage)`

## Phase 1: Quick Wins (High Impact, Medium Complexity)
**Goal**: Reach ~35% coverage by testing smaller, focused services

### Priority 1: Database Services (Estimated +8-10% coverage)
These are critical, well-isolated services that are easier to test:

1. **`dbConnectionService.ts`** (203 lines, 0% coverage)
   - Connection management
   - Connection pooling
   - Error handling
   - **Impact**: ~1.5% coverage gain
   - **Complexity**: Medium
   - **Estimated Tests**: 25-30

2. **`dbQueryGenerator.ts`** (120 lines, 0% coverage)
   - Query generation logic
   - Parameter binding
   - SQL injection prevention
   - **Impact**: ~0.9% coverage gain
   - **Complexity**: Low-Medium
   - **Estimated Tests**: 20-25

3. **`dbQueryValidator.ts`** (93 lines, 0% coverage)
   - Query validation
   - Security checks
   - Permission validation
   - **Impact**: ~0.7% coverage gain
   - **Complexity**: Low-Medium
   - **Estimated Tests**: 15-20

4. **`dbBlockExecutionService.ts`** (68 lines, 0% coverage)
   - Block execution logic
   - Error handling
   - **Impact**: ~0.5% coverage gain
   - **Complexity**: Low
   - **Estimated Tests**: 15-20

**Phase 1 Total Estimated Impact**: ~3.6% coverage gain

### Priority 2: Database Drivers (Estimated +5-6% coverage)
These follow similar patterns, so testing one helps with the others:

5. **`dbDrivers/mysqlDriver.ts`** (202 lines, 0% coverage)
   - Connection management
   - Query execution
   - Error handling
   - **Impact**: ~1.5% coverage gain
   - **Complexity**: Medium
   - **Estimated Tests**: 30-35

6. **`dbDrivers/postgresqlDriver.ts`** (181 lines, 0% coverage)
   - Similar to MySQL driver
   - **Impact**: ~1.3% coverage gain
   - **Complexity**: Medium
   - **Estimated Tests**: 30-35

7. **`dbDrivers/sqliteDriver.ts`** (191 lines, 0% coverage)
   - Similar to other drivers
   - **Impact**: ~1.4% coverage gain
   - **Complexity**: Medium
   - **Estimated Tests**: 30-35

**Phase 2 Total Estimated Impact**: ~4.2% coverage gain

### Priority 3: Calendar Services (Estimated +4-5% coverage)

8. **`calendarActionDetectionService.ts`** (302 lines, 0% coverage)
   - Action detection logic
   - Pattern matching
   - **Impact**: ~2.2% coverage gain
   - **Complexity**: Medium
   - **Estimated Tests**: 40-50

9. **`calendarProviders/googleCalendarProvider.ts`** (266 lines, 0% coverage)
   - Google Calendar API integration
   - OAuth flow
   - **Impact**: ~1.9% coverage gain
   - **Complexity**: Medium-High
   - **Estimated Tests**: 35-45

**Phase 3 Total Estimated Impact**: ~4.1% coverage gain

**Phases 1-3 Combined**: ~11.9% coverage gain → **~32% total coverage**

---

## Phase 2: Medium Impact (Medium Complexity)
**Goal**: Reach ~42% coverage

### Priority 4: Context & Cloud Services

10. **`contextRetrievalService.ts`** (538 lines, 13.13% coverage)
    - Improve from 13% to ~70%
    - Context retrieval logic
    - **Impact**: ~3.1% coverage gain
    - **Complexity**: Medium-High
    - **Estimated Tests**: 60-80

11. **`cloudContextRetrievalService.ts`** (365 lines, 0% coverage)
    - Cloud context retrieval
    - File access
    - **Impact**: ~2.7% coverage gain
    - **Complexity**: Medium-High
    - **Estimated Tests**: 40-60

12. **`cloudProviders/googleDriveProvider.ts`** (653 lines, 0% coverage)
    - Google Drive integration
    - OAuth flow
    - **Impact**: ~4.8% coverage gain
    - **Complexity**: High
    - **Estimated Tests**: 80-100

13. **`cloudProviders/nextcloudProvider.ts`** (414 lines, 0% coverage)
    - Nextcloud integration
    - **Impact**: ~3.0% coverage gain
    - **Complexity**: Medium-High
    - **Estimated Tests**: 50-70

**Phase 4 Total Estimated Impact**: ~13.6% coverage gain

**After Phase 4**: ~32% + 13.6% = **~45.6% total coverage** ✅ (Close to 50%!)

---

## Phase 3: High Impact, High Complexity
**Goal**: Reach 50%+ coverage and maintain it

### Priority 5: Large Services

14. **`chatAnsweringService.ts`** (1454 lines, 23.43% coverage)
    - Improve from 23% to ~60%
    - Core chat logic
    - **Impact**: ~5.3% coverage gain
    - **Complexity**: Very High
    - **Estimated Tests**: 150-200

15. **`llmService.ts`** (1322 lines, 38.19% coverage)
    - Improve from 38% to ~70%
    - LLM provider integration
    - **Impact**: ~4.2% coverage gain
    - **Complexity**: High
    - **Estimated Tests**: 100-150

16. **`dbSchemaDiscovery.ts`** (555 lines, 0% coverage)
    - Schema discovery logic
    - **Impact**: ~4.0% coverage gain
    - **Complexity**: Medium-High
    - **Estimated Tests**: 60-80

**Phase 5 Total Estimated Impact**: ~13.5% coverage gain

**After Phase 5**: ~45.6% + 13.5% = **~59.1% total coverage** ✅✅ (Exceeds 50%!)

---

## Phase 4: Remaining Large Files (Optional - for 60%+ coverage)

17. **`calendarBlockExecutionService.ts`** (2176 lines, 0% coverage)
    - Very large file
    - **Impact**: ~15.8% coverage gain
    - **Complexity**: Very High
    - **Estimated Tests**: 200-300
    - **Note**: This is the largest file. Testing it would push coverage to ~75%+

18. **`calendarProviders/caldavProvider.ts`** (1688 lines, 0% coverage)
    - CalDAV integration
    - **Impact**: ~12.2% coverage gain
    - **Complexity**: Very High
    - **Estimated Tests**: 150-200

19. **`semantic-chunking.ts`** (697 lines, 0% coverage)
    - Semantic chunking logic
    - **Impact**: ~5.0% coverage gain
    - **Complexity**: Medium-High
    - **Estimated Tests**: 80-100

20. **`updateWeaviateSchemas.ts`** (381 lines, 0% coverage)
    - Weaviate schema updates
    - **Impact**: ~2.8% coverage gain
    - **Complexity**: Medium
    - **Estimated Tests**: 40-50

---

## Recommended Execution Order

### Sprint 1 (Quick Wins - ~1 week)
1. `dbQueryGenerator.ts` (20-25 tests)
2. `dbQueryValidator.ts` (15-20 tests)
3. `dbBlockExecutionService.ts` (15-20 tests)
4. `dbConnectionService.ts` (25-30 tests)
**Target**: +3.6% → **~23.6% coverage**

### Sprint 2 (Database Drivers - ~1 week)
5. `dbDrivers/mysqlDriver.ts` (30-35 tests)
6. `dbDrivers/postgresqlDriver.ts` (30-35 tests)
7. `dbDrivers/sqliteDriver.ts` (30-35 tests)
**Target**: +4.2% → **~27.8% coverage**

### Sprint 3 (Calendar Services - ~1 week)
8. `calendarActionDetectionService.ts` (40-50 tests)
9. `calendarProviders/googleCalendarProvider.ts` (35-45 tests)
**Target**: +4.1% → **~31.9% coverage**

### Sprint 4 (Context Services - ~1.5 weeks)
10. `contextRetrievalService.ts` (60-80 tests)
11. `cloudContextRetrievalService.ts` (40-60 tests)
**Target**: +5.8% → **~37.7% coverage**

### Sprint 5 (Cloud Providers - ~1.5 weeks)
12. `cloudProviders/googleDriveProvider.ts` (80-100 tests)
13. `cloudProviders/nextcloudProvider.ts` (50-70 tests)
**Target**: +7.8% → **~45.5% coverage** ✅ **CLOSE TO 50%!**

### Sprint 6 (Large Services - ~2 weeks)
14. `chatAnsweringService.ts` (150-200 tests)
15. `llmService.ts` (100-150 tests)
16. `dbSchemaDiscovery.ts` (60-80 tests)
**Target**: +13.5% → **~59.0% coverage** ✅✅ **EXCEEDS 50%!**

---

## Testing Strategy Per File Type

### Database Services
- Mock database connections
- Test query generation/validation
- Test error handling
- Test SQL injection prevention
- Test parameter binding

### Calendar Services
- Mock OAuth providers
- Mock calendar APIs
- Test event CRUD operations
- Test error handling
- Test permission checks

### Cloud Services
- Mock cloud APIs (Google Drive, Nextcloud)
- Mock OAuth flows
- Test file operations
- Test permission checks
- Test error handling

### Large Services (chatAnsweringService, llmService)
- Focus on critical paths first
- Test main functions
- Test error handling
- Test edge cases
- Don't aim for 100% initially - aim for 60-70%

---

## Key Metrics to Track

- **Coverage per Sprint**: Track progress after each sprint
- **Tests per File**: Aim for 20-30 tests for medium files, 50-100 for large files
- **Time per Test**: Average 10-15 minutes per test (including setup)
- **Coverage Gain per Test**: Track which files give the most coverage per test

---

## Notes

1. **Start Small**: Begin with smaller, isolated services to build momentum
2. **Reuse Patterns**: Database drivers follow similar patterns - test one thoroughly, then adapt
3. **Focus on Critical Paths**: For very large files, focus on main functions first
4. **Don't Aim for 100%**: Aim for 60-70% on large files initially
5. **Track Progress**: After each sprint, run full coverage report to see progress

---

## Estimated Total Effort

- **Sprints 1-3**: ~3 weeks → **~32% coverage**
- **Sprints 4-5**: ~3 weeks → **~45.5% coverage** (close to 50%!)
- **Sprint 6**: ~2 weeks → **~59% coverage** (exceeds 50%!)

**Total**: ~8 weeks to reach 50%+ coverage

---

## Quick Reference: File Sizes & Current Coverage

| File | Lines | Current Coverage | Target Coverage | Impact | Priority |
|------|-------|------------------|----------------|--------|----------|
| `dbQueryGenerator.ts` | 120 | 0% | 80% | +0.9% | 1 |
| `dbQueryValidator.ts` | 93 | 0% | 80% | +0.7% | 2 |
| `dbBlockExecutionService.ts` | 68 | 0% | 80% | +0.5% | 3 |
| `dbConnectionService.ts` | 203 | 0% | 80% | +1.5% | 4 |
| `dbDrivers/mysqlDriver.ts` | 202 | 0% | 80% | +1.5% | 5 |
| `dbDrivers/postgresqlDriver.ts` | 181 | 0% | 80% | +1.3% | 6 |
| `dbDrivers/sqliteDriver.ts` | 191 | 0% | 80% | +1.4% | 7 |
| `calendarActionDetectionService.ts` | 302 | 0% | 70% | +2.2% | 8 |
| `calendarProviders/googleCalendarProvider.ts` | 266 | 0% | 70% | +1.9% | 9 |
| `contextRetrievalService.ts` | 538 | 13% | 70% | +3.1% | 10 |
| `cloudContextRetrievalService.ts` | 365 | 0% | 70% | +2.7% | 11 |
| `cloudProviders/googleDriveProvider.ts` | 653 | 0% | 70% | +4.8% | 12 |
| `cloudProviders/nextcloudProvider.ts` | 414 | 0% | 70% | +3.0% | 13 |
| `chatAnsweringService.ts` | 1454 | 23% | 60% | +5.3% | 14 |
| `llmService.ts` | 1322 | 38% | 70% | +4.2% | 15 |
| `dbSchemaDiscovery.ts` | 555 | 0% | 70% | +4.0% | 16 |
| `calendarBlockExecutionService.ts` | 2176 | 0% | 60% | +15.8% | 17 (optional) |
| `calendarProviders/caldavProvider.ts` | 1688 | 0% | 60% | +12.2% | 18 (optional) |

---

## Next Steps

1. **Start with Sprint 1**: Begin testing `dbQueryGenerator.ts`
2. **Track Progress**: After each file, run coverage report
3. **Adjust Strategy**: If a file is harder than expected, move to next one
4. **Celebrate Milestones**: 30%, 40%, 45%, 50%!
