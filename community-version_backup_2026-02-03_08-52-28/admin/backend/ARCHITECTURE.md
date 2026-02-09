# Architecture Overview

## Before Refactoring

```
┌─────────────────────────────────────────────────────────┐
│  Routes & Controllers                                   │
│  ├── auth/index.ts (tight coupling to email)          │
│  ├── chatbots/index.ts (imports subscriptionCache)    │
│  ├── subscription.ts (direct Prisma queries)          │
│  ├── billing.ts (hardcoded limits)                    │
│  ├── enterprise.ts (async email sending)              │
│  ├── paymentLinks.ts (Stripe API calls)               │
│  └── instances.ts (admin operations)                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Middleware                                             │
│  ├── subscriptionMiddleware.ts                         │
│  │   ├── checkChatbotLimit (Prisma query hardcoded)   │
│  │   ├── checkMessageLimit (Prisma query hardcoded)   │
│  │   └── checkIndexedPagesLimit (Prisma query)        │
│  └── auth.ts (email verification hardcoded)           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Business Services                                      │
│  ├── zoho-email.ts (tight coupling)                    │
│  ├── subscriptionUsageCache.ts (direct access)        │
│  ├── stripeService.ts (Stripe integration)            │
│  └── subscriptionLimits.ts (utility functions)        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Database (Prisma)                                      │
│  ├── Subscription                                       │
│  ├── SubscriptionPlan                                   │
│  ├── Chatbot                                            │
│  ├── AdminUser                                          │
│  └── ...                                                │
└─────────────────────────────────────────────────────────┘

PROBLEM: Business logic tightly coupled to core routes
         Hard to remove/disable features
         Three variants need separate codebases
```

## After Refactoring

```
┌──────────────────────────────────────────────────────────────┐
│  Feature-Agnostic Routes & Controllers                       │
│  ├── auth/index.ts (uses INotificationService)              │
│  ├── chatbots/index.ts (uses ISubscriptionService)          │
│  ├── dashboard/* (business independent)                      │
│  ├── profile/* (business independent)                        │
│  └── widget/* (business independent)                         │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  Abstraction Layer (Interfaces)                              │
│  ┌──────────────────────┐  ┌──────────────────────┐          │
│  │ ISubscriptionService │  │ INotificationService │          │
│  ├──────────────────────┤  ├──────────────────────┤          │
│  │ canCreateChatbot()   │  │ sendVerificationEmail│          │
│  │ canSendMessage()     │  │ sendPasswordReset()  │          │
│  │ canIndexPages()      │  │ sendReceipt()        │          │
│  │ getChatbotCount()    │  │ sendNotification()   │          │
│  │ getSubscriptionInfo()│  │                      │          │
│  │ invalidateCache()    │  │                      │          │
│  └──────────────────────┘  └──────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
                   ↗         ↙
              ROUTING DECISION
                   ↗         ↙
          Based on Feature Flags
     (FEATURE_BILLING=true/false)
                   ↗         ↙
    ┌─────────────────────────────────────┐
    │       Service Factory                │
    │  getSubscriptionService()            │
    │  getNotificationService()            │
    └─────────────────────────────────────┘
            ↗                       ↙
     BUSINESS                  COMMUNITY
        MODE                      MODE
     (Features                  (Features
      Enabled)                   Disabled)
         ↓                          ↓
┌─────────────────────────┐  ┌──────────────────────────┐
│ Business                │  │ Community                │
│ Implementations         │  │ (No-op) Implementations  │
├─────────────────────────┤  ├──────────────────────────┤
│ • BusinessSubscription  │  │ • CommunitySubscription  │
│   Service               │  │   Service                │
│   - Enforces limits     │  │   - Allows everything    │
│   - Checks DB           │  │   - No DB access         │
│   - Manages cache       │  │   - No-op methods        │
│                         │  │                          │
│ • BusinessNotification  │  │ • CommunityNotification  │
│   Service               │  │   Service                │
│   - Sends emails        │  │   - Silent no-ops        │
│   - Via Zoho            │  │   - Logs only            │
│   - Async delivery      │  │   - Never fails          │
└─────────────────────────┘  └──────────────────────────┘
         ↓                          ↓
┌─────────────────────────┐  ┌──────────────────────────┐
│ Business Services       │  │ Database (Optional)      │
│ (If Needed)             │  │ Not accessed in          │
├─────────────────────────┤  │ Community mode           │
│ • zoho-email.ts         │  │                          │
│ • stripeService.ts      │  │                          │
│ • subscriptionCache.ts  │  │                          │
│ • subscriptionLimits.ts │  │                          │
└─────────────────────────┘  └──────────────────────────┘
         ↓
┌─────────────────────────┐
│ Stripe/Zoho APIs        │
│ (Only in Business mode) │
└─────────────────────────┘

SOLUTION: Clear separation of concerns
          Easy feature toggling
          Single codebase for all variants
          Fail-safe design (allow if service fails)
```

## Deployment Variants

```
┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐
│   BUSINESS EDITION       │  │   CUSTOM EDITION         │  │  COMMUNITY EDITION       │
├──────────────────────────┤  ├──────────────────────────┤  ├──────────────────────────┤
│ Environment:             │  │ Environment:             │  │ Environment:             │
│ FEATURE_BILLING=true     │  │ FEATURE_BILLING=false    │  │ FEATURE_BILLING=false    │
│ FEATURE_ENTERPRISE=true  │  │ FEATURE_ENTERPRISE=false │  │ FEATURE_ENTERPRISE=false │
│                          │  │                          │  │                          │
│ Route Loading:           │  │ Route Loading:           │  │ Route Loading:           │
│ ✓ Subscription routes    │  │ ✗ Subscription routes    │  │ ✗ Subscription routes    │
│ ✓ Payment links          │  │ ✗ Payment links          │  │ ✗ Payment links          │
│ ✓ Enterprise routes      │  │ ✗ Enterprise routes      │  │ ✗ Enterprise routes      │
│ ✓ Billing routes         │  │ ✗ Billing routes         │  │ ✗ Billing routes         │
│                          │  │                          │  │                          │
│ Service Type:            │  │ Service Type:            │  │ Service Type:            │
│ Business*Service         │  │ Business*Service         │  │ Community*Service        │
│ (Full featured)          │  │ (Gracefully degrades)    │  │ (Always allows)          │
│                          │  │                          │  │                          │
│ Database Usage:          │  │ Database Usage:          │  │ Database Usage:          │
│ • Subscriptions tracked  │  │ • Subscriptions ignored  │  │ • Subscriptions ignored  │
│ • Limits enforced        │  │ • No limits enforced     │  │ • No limits enforced     │
│ • All features available │  │ • All features available*│  │ • Core features only     │
│                          │  │ • But not enforced       │  │                          │
│                          │  │                          │  │                          │
│ Use Cases:               │  │ Use Cases:               │  │ Use Cases:               │
│ • SaaS deployments       │  │ • On-premise            │  │ • Open-source           │
│ • Multi-tenant           │  │ • Private cloud         │  │ • Education/research    │
│ • Paid features          │  │ • Custom deployments    │  │ • Non-commercial        │
│ • Stripe integration     │  │ • Premium on-premise    │  │ • Community forks       │
│                          │  │                          │  │                          │
│ Email Sending:           │  │ Email Sending:           │  │ Email Sending:           │
│ ✓ Verification emails    │  │ ✓ Verification emails    │  │ ✗ No emails              │
│ ✓ Receipts               │  │ ✓ Receipts (optional)    │  │ (Silent no-ops)          │
│ ✓ Notifications          │  │ ✓ Notifications (opt.)   │  │                          │
└──────────────────────────┘  └──────────────────────────┘  └──────────────────────────┘
```

## Code Flow Example

### Business Edition (Feature Flag Enabled)

```
User Registration Request
        ↓
┌─────────────────────────────────────────┐
│ POST /api/admin/auth/register           │
│ ├─ Validate input                       │
│ ├─ Create admin user in DB              │
│ ├─ Create test user                     │
│ ├─ Create trial subscription            │
│ └─ Send verification email              │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Route calls:                            │
│ notificationService =                   │
│   getNotificationService()              │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Feature Flag Check:                     │
│ isFeatureEnabled('billing') == true     │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Service Factory Returns:                │
│ new BusinessNotificationService()       │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Call:                                   │
│ await service.sendVerificationEmail()   │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ BusinessNotificationService:            │
│ ├─ Get email service client             │
│ ├─ Call Zoho API                        │
│ ├─ Log result                           │
│ ├─ Don't throw (email optional)         │
│ └─ Continue with registration           │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Response: 201 Created                   │
│ "Registration successful. Check email"  │
└─────────────────────────────────────────┘
```

### Community Edition (Feature Flag Disabled)

```
User Registration Request
        ↓
┌─────────────────────────────────────────┐
│ POST /api/admin/auth/register           │
│ ├─ Validate input                       │
│ ├─ Create admin user in DB              │
│ ├─ Create test user                     │
│ └─ (No subscription created)            │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Route calls:                            │
│ notificationService =                   │
│   getNotificationService()              │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Feature Flag Check:                     │
│ isFeatureEnabled('billing') == false    │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Service Factory Returns:                │
│ new CommunityNotificationService()      │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Call:                                   │
│ await service.sendVerificationEmail()   │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ CommunityNotificationService:           │
│ ├─ Log debug message (skipping)         │
│ └─ Return immediately (no-op)           │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Response: 201 Created                   │
│ "Registration successful."              │
│ (User never receives email - by design) │
└─────────────────────────────────────────┘
```

## Key Benefits

```
┌─────────────────────────┐
│ Before Refactoring      │
├─────────────────────────┤
│ ✗ Business logic mixed  │
│   with core code        │
│ ✗ Hard to remove        │
│   features              │
│ ✗ Multiple codebases    │
│   for variants          │
│ ✗ Tight coupling        │
│ ✗ Hard to test          │
│ ✗ Maintenance nightmare │
│ ✗ Can't disable Billing │
│   without rewriting     │
└─────────────────────────┘

        REFACTORED TO:

┌─────────────────────────┐
│ After Refactoring       │
├─────────────────────────┤
│ ✓ Business logic in     │
│   services layer        │
│ ✓ Easy to remove/add    │
│   features              │
│ ✓ Single codebase for   │
│   all variants          │
│ ✓ Loose coupling        │
│ ✓ Easy to test & mock   │
│ ✓ Maintainable code     │
│ ✓ Disable Billing via   │
│   feature flag          │
└─────────────────────────┘
```
