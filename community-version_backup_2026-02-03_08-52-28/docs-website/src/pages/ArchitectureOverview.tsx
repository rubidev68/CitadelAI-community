import MarkdownRenderer from "@/components/MarkdownRenderer";

const ArchitectureOverview = () => {
  const content = `# Architecture Overview

**Purpose:** Understand the CitadelAI architecture

## System Architecture

CitadelAI follows a microservices architecture with clear separation of concerns.

### Core Services

- **User Backend** (Port 3003) - User-facing API
- **Admin Backend** (Port 3002) - Admin management API
- **Crawling Service** (Port 3001) - Web crawling engine
- **Cron Scheduler** (Port 3004) - Scheduled tasks

### Data Layer

- **PostgreSQL** - Primary database
- **Weaviate** - Vector database for semantic search

### Integrations

- **Nextcloud** - Open-source cloud storage integration
- **AI Providers** - Gemini, OpenAI, Anthropic, Mistral

## Service Architecture

All core services are included:

- ✅ User Backend - User-facing API and chat functionality
- ✅ Admin Backend - Admin management API
- ✅ Crawling Service - Web crawling and content indexing
- ✅ Cron Scheduler - Scheduled tasks and automation

## Integration Architecture

### Cloud Provider Integration

CitadelAI supports open-source cloud storage:

- ✅ **Nextcloud** - Open-source, self-hosted cloud storage integration

### Removed from Business Edition

The following integrations and services are **NOT included** in CitadelAI (they exist only in the Business Edition):

#### ❌ Removed Services
- **Email Service** - Complete removal (business-specific)
- **Subscription System** - Complete removal (billing is business-specific)
- **Business Website** - Complete removal (marketing site is business-specific)
- **Instance Provisioning Service** - Complete removal (dedicated instances are business-specific)
- **AdminJS Dashboard** - Complete removal (enterprise database management)

#### ❌ Removed Proprietary Integrations
- **Slack Integration** - Removed (proprietary)
- **Microsoft Teams Integration** - Removed (proprietary)
- **Google Drive Integration** - Removed (proprietary)
- **OneDrive Integration** - Removed (proprietary)

#### ❌ Removed Business Features
- **Stripe Payment Processing** - Removed (billing is business-specific)
- **Advanced Analytics Dashboard** - Removed (enterprise feature)
- **Enterprise User Management** - Removed (enterprise feature)
- **Advanced Permissions System** - Removed (enterprise feature)

**Important:** These features are **exclusive to the Business Edition** and should **NOT** be developed in the open-source version.

## Shared Packages

CitadelAI uses shared packages for code reuse:

- \`@shared/utils\` - Utilities and helpers
- \`@shared/services\` - Shared service implementations
- \`@shared/types\` - TypeScript type definitions
- \`@shared/resilience\` - Resilience library with circuit breakers and retry logic

## Database Schema

CitadelAI uses a clean, focused schema:

- Core tables (users, chatbots, blocks, chat sessions, etc.)
- Efficient indexing for performance
- Support for vector search integration
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default ArchitectureOverview;
