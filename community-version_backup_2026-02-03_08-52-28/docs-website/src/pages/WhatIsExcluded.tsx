import MarkdownRenderer from "@/components/MarkdownRenderer";

const WhatIsExcluded = () => {
  const content = `# What is Excluded from CitadelAI

This page explains what features and integrations are **NOT included** in CitadelAI (the open-source version) because they exist exclusively in the Business Edition.

## Overview

CitadelAI is the open-source version. The Business Edition includes additional proprietary features, integrations, and services that are **not available** in the open-source version.

## Removed Services

### Email Service ❌

**Status:** Completely removed  
**Reason:** Business-specific functionality

**What was removed:**
- Entire \`email-service/\` directory
- Email service client (\`emailServiceClient.ts\`)
- Email service from docker-compose
- All email service references in code
- Email service tests

**Note:** CitadelAI has **NO email service** - it was completely removed as it's business-specific.

### Subscription & Billing System ❌

**Status:** Completely removed  
**Reason:** Billing is business-specific

**What was removed:**
- Stripe integration
- Subscription management system
- Payment processing
- Billing APIs
- Subscription plans
- Usage tracking for billing
- Invoice generation

**Note:** CitadelAI is **completely free** - no subscription system exists.

### Business Website ❌

**Status:** Completely removed  
**Reason:** Marketing website is business-specific

**What was removed:**
- Entire \`business_website/\` directory
- Marketing pages
- Pricing pages
- Business-specific content

### Instance Provisioning Service ❌

**Status:** Completely removed  
**Reason:** Dedicated instances are enterprise feature

**What was removed:**
- Instance provisioning service
- Dedicated instance management
- Subdomain configuration for instances
- Resource template management

### AdminJS Dashboard ❌

**Status:** Completely removed  
**Reason:** Enterprise database management tool

**What was removed:**
- AdminJS dashboard interface
- Database management UI
- Enterprise admin tools

## Removed Proprietary Integrations

### Slack Integration ❌

**Status:** Completely removed  
**Reason:** Proprietary integration

**What was removed:**
- Slack API client
- Slack OAuth service
- Slack webhook service
- Slack message processing
- All Slack-related routes and services

### Microsoft Teams Integration ❌

**Status:** Completely removed  
**Reason:** Proprietary integration

**What was removed:**
- Teams API integration
- Teams OAuth
- Teams webhook handling

### Google Drive Integration ❌

**Status:** Completely removed  
**Reason:** Proprietary integration

**What was removed:**
- Google Drive provider (\`googleDriveProvider.ts\`)
- Google Drive OAuth
- Google Drive file indexing
- Google Drive API integration

### OneDrive Integration ❌

**Status:** Completely removed  
**Reason:** Proprietary integration

**What was removed:**
- OneDrive provider (\`oneDriveProvider.ts\`)
- OneDrive OAuth
- OneDrive file indexing
- OneDrive API integration

## Removed Business Features

### Enterprise User Management ❌

**Status:** Removed  
**Reason:** Enterprise feature

**What was removed:**
- Advanced permissions system
- Granular access control
- Role management
- Enterprise user administration

### Advanced Analytics ❌

**Status:** Removed  
**Reason:** Enterprise feature

**What was removed:**
- Advanced analytics dashboard
- Business intelligence features
- Custom reporting
- Enterprise metrics

### Premium AI Models ❌

**Status:** Removed  
**Reason:** Business feature

**What was removed:**
- Premium AI model access
- Advanced AI configuration
- Model selection features

## What is Kept ✅

### Open-Source Integrations

- ✅ **Nextcloud** - Open-source, self-hosted cloud storage (kept because it's open-source)

### Core Services

- ✅ User Backend - User-facing API
- ✅ Admin Backend - Admin management API
- ✅ Crawling Service - Web crawling engine
- ✅ Cron Scheduler - Scheduled tasks

### Core Features

- ✅ Chat functionality
- ✅ Chatbot management
- ✅ Block-based visual editor
- ✅ Website context crawling
- ✅ Document processing
- ✅ AI model integration (standard models)

## Why These Exclusions?

1. **Business Model Separation**: Business Edition features are proprietary and fund development
2. **Open-Source Focus**: CitadelAI focuses on core, open-source compatible functionality
3. **Maintenance**: Separating features reduces maintenance burden
4. **Clarity**: Clear distinction between open-source and proprietary features

## For Contributors

**IMPORTANT:** Do **NOT** develop integrations or features that already exist in the Business Edition. This includes:

- ❌ Slack, Teams, Google Drive, OneDrive integrations
- ❌ Email service
- ❌ Subscription/billing systems
- ❌ Enterprise features

Instead, focus on:
- ✅ Open-source compatible integrations
- ✅ Core functionality improvements
- ✅ New open-source integrations (not in Business Edition)
- ✅ Documentation and developer experience

See the [Contributing Guide](/contributing/guide) for more details.
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default WhatIsExcluded;
