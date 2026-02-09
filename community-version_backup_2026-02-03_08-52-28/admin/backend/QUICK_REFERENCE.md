# Quick Reference: Business Logic Decoupling

## Using Services in Your Code

### Check Subscription Limits

```typescript
import { getSubscriptionService } from '../services/serviceFactory';

// In a route or controller
const subscriptionService = getSubscriptionService();

// Check if user can create a chatbot
const limitInfo = await subscriptionService.canCreateChatbot(userId);
if (!limitInfo.allowed) {
  return res.status(403).json({ 
    error: 'Chatbot limit reached',
    reason: limitInfo.reason
  });
}

// Get current chatbot count
const count = await subscriptionService.getChatbotCount(userId);

// Get full subscription info
const info = await subscriptionService.getSubscriptionInfo(userId);
console.log(info.planName); // 'Pro', 'Starter', etc.
```

### Send Notifications

```typescript
import { getNotificationService } from '../services/serviceFactory';

const notificationService = getNotificationService();

// Send verification email (silently skipped in Community Edition)
await notificationService.sendVerificationEmail(email, token, baseUrl);

// Send password reset
await notificationService.sendPasswordResetEmail(email, resetUrl);

// Send receipt
await notificationService.sendSubscriptionReceiptEmail(
  email, 
  'Pro Plan', 
  99.99, 
  'USD'
);

// Generic notification
await notificationService.sendNotification(
  email,
  'Important Update',
  '<p>Your account has been updated</p>',
  'Your account has been updated'
);
```

### Invalidate Cache

```typescript
import { getSubscriptionService } from '../services/serviceFactory';

const subscriptionService = getSubscriptionService();

// After creating/deleting a chatbot
subscriptionService.invalidateCache(userId);
```

## Environment Variables

```bash
# Enable/disable billing features
FEATURE_BILLING=true         # true = Business/Custom, false = Community
FEATURE_ENTERPRISE=true      # true = includes enterprise, false = skips

# Email configuration (if FEATURE_BILLING=true)
ZOHO_EMAIL_API_KEY=...
ZOHO_EMAIL_FROM=...
```

## Variants

### Community Edition
```bash
FEATURE_BILLING=false
FEATURE_ENTERPRISE=false
# ✓ All routes work
# ✓ No subscription limits enforced
# ✓ No emails sent
# ✓ Minimal database usage
```

### Custom Edition
```bash
FEATURE_BILLING=false
FEATURE_ENTERPRISE=false
# Same as Community, but:
# ✓ Business code still available (just disabled)
# ✓ Can enable features without rebuilding
# ✓ Perfect for on-premise customers
```

### Business Edition
```bash
FEATURE_BILLING=true
FEATURE_ENTERPRISE=true
# ✓ Full subscription management
# ✓ Enterprise features (instances, etc.)
# ✓ Email notifications
# ✓ Stripe integration
```

## File Structure

```
admin/backend/src/
├── services/
│   ├── interfaces/
│   │   ├── ISubscriptionService.ts   (What you implement)
│   │   └── INotificationService.ts   (What you implement)
│   ├── Business*.ts                   (Real implementation)
│   ├── Community*.ts                  (No-op implementation)
│   └── serviceFactory.ts             (Auto-select based on features)
│
├── routes/
│   ├── auth/index.ts                 (Uses INotificationService)
│   ├── chatbots/index.ts             (Uses ISubscriptionService)
│   ├── subscription.ts               (Business only)
│   ├── billing.ts                    (Business only)
│   ├── enterprise.ts                 (Business only)
│   └── business.ts                   (Routes consolidation)
│
└── middleware/
    └── subscriptionMiddleware.ts     (Uses ISubscriptionService)
```

## Adding a New Subscription Check

### Step 1: Add to ISubscriptionService
```typescript
// src/services/interfaces/ISubscriptionService.ts
export interface ISubscriptionService {
  // ... existing methods ...
  canUseAdvancedFeature(userId: string): Promise<SubscriptionLimitInfo>;
}
```

### Step 2: Implement in Both Versions
```typescript
// src/services/BusinessSubscriptionService.ts
async canUseAdvancedFeature(userId: string): Promise<SubscriptionLimitInfo> {
  // Check if plan includes advanced feature
  const plan = await this.getPlan(userId);
  if (!plan.advancedFeatures) {
    return { allowed: false, reason: 'Feature not included in your plan' };
  }
  return { allowed: true };
}

// src/services/CommunitySubscriptionService.ts
async canUseAdvancedFeature(userId: string): Promise<SubscriptionLimitInfo> {
  return { allowed: true }; // Community allows everything
}
```

### Step 3: Use in Your Code
```typescript
// Your route
const subscriptionService = getSubscriptionService();
const can = await subscriptionService.canUseAdvancedFeature(userId);
if (!can.allowed) {
  return res.status(403).json({ error: can.reason });
}
```

## Common Patterns

### Failing Gracefully
```typescript
try {
  const limit = await subscriptionService.canCreateChatbot(userId);
  // handle limit
} catch (error) {
  logger.error('Subscription check failed', { error });
  // In Business Edition: fail open (allow operation)
  // In Community Edition: never throws
  res.status(500).json({ error: 'Service unavailable' });
}
```

### Caching
```typescript
// Services handle caching automatically
// No need to manage cache manually
// Just call the service - it handles caching internally
```

### Testing
```typescript
// Test with Community implementation (no database)
import { CommunitySubscriptionService } from '../services/CommunitySubscriptionService';

const service = new CommunitySubscriptionService();
const result = await service.canCreateChatbot('test-user');
expect(result.allowed).toBe(true); // Always true
```

## Troubleshooting

### "Module not found" Error
Check that you're importing from correct path:
```typescript
// ✓ Correct
import { getSubscriptionService } from '../services/serviceFactory';
import { ISubscriptionService } from '../services/interfaces/ISubscriptionService';

// ✗ Wrong
import { BusinessSubscriptionService } from '../services/serviceFactory'; // Should use factory
import { SubscriptionService } from '../services'; // No default export
```

### Emails Not Sending in Business Edition
1. Check `FEATURE_BILLING=true`
2. Check `ZOHO_EMAIL_API_KEY` is set
3. Check logs for `BusinessNotificationService` errors
4. Test with `/api/admin/test-email?email=test@example.com`

### Subscription Limits Not Enforcing
1. Check `FEATURE_BILLING=true`
2. Check subscription exists in database
3. Check plan has limits set (not null)
4. Check user is authenticated

### Community Edition Still Requires Email Config
It shouldn't! If you see email errors in Community Edition:
```bash
# Verify feature flag
FEATURE_BILLING=false
# Restart
npm start
```

Check logs - `CommunityNotificationService` should be active (not `BusinessNotificationService`).

## Performance Tips

- Services cache subscription data - no need for extra caching
- Community Edition does zero database queries for limits
- Business Edition uses same queries as before (just through service layer)
- No N+1 query problems - `getSubscriptionInfo()` fetches everything once

## See Also

- **DECOUPLING_GUIDE.md** - Comprehensive architecture guide
- **REFACTORING_SUMMARY.md** - What changed and why
- **src/services/interfaces/ISubscriptionService.ts** - Subscription API
- **src/services/interfaces/INotificationService.ts** - Notification API
