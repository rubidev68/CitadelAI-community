import MarkdownRenderer from "@/components/MarkdownRenderer";

const ConfigurationReference = () => {
  const content = `# Configuration Reference

Complete reference for all CitadelAI configuration options.

## Environment Variables

All configuration is done via environment variables in the \`.env\` file.

## Required Configuration

### AI Provider API Keys

**At least one AI provider is required:**

\`\`\`bash
# Google Gemini (recommended for free tier)
GEMINI_API_KEY=your_gemini_api_key_here

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Mistral
MISTRAL_API_KEY=your_mistral_api_key_here
\`\`\`

**Note:** Weaviate requires OpenAI API key for vectorization:
\`\`\`bash
OPENAI_API_KEY=your_openai_key_for_weaviate
\`\`\`

### Database Configuration

\`\`\`bash
# PostgreSQL
POSTGRES_USER=citadel_user
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=citadel_db

# Connection URL (auto-generated, or override)
DATABASE_URL=postgresql://citadel_user:password@postgres:5432/citadel_db
\`\`\`

### JWT Configuration

\`\`\`bash
# JWT Secret (generate a secure random string)
JWT_SECRET=your_secure_jwt_secret_min_32_chars
\`\`\`

**Generate a secure secret:**
\`\`\`bash
openssl rand -base64 32
\`\`\`

### Weaviate Configuration

\`\`\`bash
# Weaviate URL (default: http://weaviate:8080)
WEAVIATE_URL=http://weaviate:8080

# OpenAI API key for Weaviate vectorization
OPENAI_API_KEY=your_openai_key
\`\`\`

## Service-Specific Configuration

### User Backend (Port 3003)

\`\`\`bash
# Service Port
PORT=3003

# Node Environment
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/citadel_db
WEAVIATE_URL=http://weaviate:8080

# AI Providers
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
MISTRAL_API_KEY=your_key

# JWT
JWT_SECRET=your_secret

# Internal Service Communication
ADMIN_SERVICE_URL=http://admin-backend:3002
INTERNAL_SERVICE_TOKEN=your_internal_token

# Frontend URL
FRONTEND_URL=https://chat.citadelai.app
API_URL=https://api.citadelai.app

# Weaviate Schema Recreation (development only)
ALLOW_WEAVIATE_SCHEMA_RECREATION=false
\`\`\`

### Admin Backend (Port 3002)

\`\`\`bash
# Service Port
PORT=3002

# Node Environment
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/citadel_db
WEAVIATE_URL=http://weaviate:8080

# Service URLs
CRAWLING_SERVICE_URL=http://crawling-service:3001
CRON_SCHEDULER_URL=http://cron-scheduler:3004
USER_API_INTERNAL_URL=http://user-backend:3003/api

# JWT
JWT_SECRET=your_secret

# Frontend
FRONTEND_URL=https://admin.citadelai.app
API_URL=https://api.citadelai.app

# Logging
LOG_LEVEL=info

# Nextcloud (optional)
NEXTCLOUD_URL=https://your-nextcloud.com
NEXTCLOUD_USERNAME=your_username
NEXTCLOUD_PASSWORD=your_password
\`\`\`

### Crawling Service (Port 3001)

\`\`\`bash
# Service Port
PORT=3001

# Node Environment
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/citadel_db
WEAVIATE_URL=http://weaviate:8080

# AI Providers (for content processing)
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key

# Concurrency Limits
MAX_CONCURRENT_JOBS=4
MAX_CRAWLERS_PER_JOB=5
MAX_TOTAL_CRAWLERS=20
\`\`\`

### Cron Scheduler (Port 3004)

\`\`\`bash
# Service Port
PORT=3004

# Node Environment
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/citadel_db
WEAVIATE_URL=http://weaviate:8080

# Service URLs
CRAWLING_SERVICE_URL=http://crawling-service:3001
\`\`\`

## Optional Configuration

### Nextcloud Integration

\`\`\`bash
# Nextcloud Configuration (optional)
NEXTCLOUD_URL=https://your-nextcloud.com
NEXTCLOUD_USERNAME=your_username
NEXTCLOUD_PASSWORD=your_password
\`\`\`

### Logging Configuration

\`\`\`bash
# Log Level (debug, info, warn, error)
LOG_LEVEL=info

# Enable structured logging
LOG_FORMAT=json
\`\`\`

### Performance Tuning

\`\`\`bash
# Crawling Service Concurrency
CLOUD_INDEXING_CONCURRENT_FILES=15
CLOUD_INDEXING_CONCURRENT_FOLDERS=8

# Database Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=10
\`\`\`

## Configuration by Environment

### Development

\`\`\`bash
NODE_ENV=development
LOG_LEVEL=debug
ALLOW_WEAVIATE_SCHEMA_RECREATION=true
\`\`\`

### Production

\`\`\`bash
NODE_ENV=production
LOG_LEVEL=info
ALLOW_WEAVIATE_SCHEMA_RECREATION=false
\`\`\`

## Configuration Validation

### Required Variables Checklist

- [ ] At least one AI provider API key
- [ ] \`POSTGRES_USER\` and \`POSTGRES_PASSWORD\`
- [ ] \`JWT_SECRET\` (minimum 32 characters)
- [ ] \`OPENAI_API_KEY\` (for Weaviate)

### Optional Variables

- [ ] \`NEXTCLOUD_*\` variables (if using Nextcloud)
- [ ] \`LOG_LEVEL\` (defaults to \`info\`)
- [ ] Custom service URLs (if not using defaults)

## Environment File Template

\`\`\`bash
# ============================================
# AI Provider Configuration
# ============================================
# At least one required
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
MISTRAL_API_KEY=

# ============================================
# Database Configuration
# ============================================
POSTGRES_USER=citadel_user
POSTGRES_PASSWORD=change_me_secure_password
POSTGRES_DB=citadel_db
DATABASE_URL=postgresql://citadel_user:change_me_secure_password@postgres:5432/citadel_db

# ============================================
# Security
# ============================================
JWT_SECRET=change_me_generate_secure_random_string_min_32_chars
INTERNAL_SERVICE_TOKEN=change_me_internal_service_token

# ============================================
# Weaviate Configuration
# ============================================
WEAVIATE_URL=http://weaviate:8080
# OPENAI_API_KEY required for Weaviate vectorization

# ============================================
# Service URLs (optional, defaults provided)
# ============================================
CRAWLING_SERVICE_URL=http://crawling-service:3001
CRON_SCHEDULER_URL=http://cron-scheduler:3004
USER_API_INTERNAL_URL=http://user-backend:3003/api

# ============================================
# Frontend URLs (for production)
# ============================================
FRONTEND_URL=https://chat.citadelai.app
API_URL=https://api.citadelai.app

# ============================================
# Nextcloud Integration (optional)
# ============================================
NEXTCLOUD_URL=
NEXTCLOUD_USERNAME=
NEXTCLOUD_PASSWORD=

# ============================================
# Logging
# ============================================
LOG_LEVEL=info
NODE_ENV=production

# ============================================
# Performance Tuning (optional)
# ============================================
CLOUD_INDEXING_CONCURRENT_FILES=15
CLOUD_INDEXING_CONCURRENT_FOLDERS=8
\`\`\`

## Security Best Practices

1. **Never commit \`.env\` files** - Add to \`.gitignore\`
2. **Use strong passwords** - Generate secure random strings
3. **Rotate secrets regularly** - Especially JWT_SECRET
4. **Limit API key permissions** - Use least privilege principle
5. **Use environment-specific files** - \`.env.production\`, \`.env.development\`

## Next Steps

- [Getting Started](/getting-started) - Initial setup guide
- [Deployment Guide](/deployment/guide) - Production configuration
- [Troubleshooting](/troubleshooting/guide) - Configuration issues
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default ConfigurationReference;
