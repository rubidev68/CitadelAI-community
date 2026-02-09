import MarkdownRenderer from "@/components/MarkdownRenderer";

const GettingStarted = () => {
  const content = `# Getting Started

Complete guide to get CitadelAI up and running.

## Prerequisites

### System Requirements

**Minimum Requirements:**
- **CPU**: 4 cores (2.0 GHz)
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **Network**: 100 Mbps

**Recommended Requirements:**
- **CPU**: 8 cores (3.0 GHz)
- **RAM**: 16 GB
- **Storage**: 100 GB SSD
- **Network**: 1 Gbps

### Software Requirements

**Required:**
- **Docker**: >= 20.0.0
- **Docker Compose**: >= 2.0.0
- **Git**: Latest version

**Optional (for development):**
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0

### External Services

**Required:**
- **AI Provider API Key**: At least one of:
  - Google Gemini API key
  - OpenAI API key
  - Anthropic API key
  - Mistral API key

**Optional:**
- **Nextcloud Instance**: For cloud storage integration

## Quick Start

### 1. Clone the Repository

\`\`\`bash
git clone https://github.com/rubidev68/citadelai-community.git
cd citadelai-community
\`\`\`

### 2. Environment Setup

Create a \`.env\` file in the root directory:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit \`.env\` and configure at minimum:

\`\`\`bash
# AI Provider (at least one required)
GEMINI_API_KEY=your_gemini_api_key_here
# OR
OPENAI_API_KEY=your_openai_api_key_here
# OR
ANTHROPIC_API_KEY=your_anthropic_api_key_here
# OR
MISTRAL_API_KEY=your_mistral_api_key_here

# Database
POSTGRES_USER=citadel_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=citadel_db

# JWT Secret (generate a secure random string)
JWT_SECRET=your_secure_jwt_secret_here

# Weaviate
OPENAI_API_KEY=your_openai_key_for_weaviate
\`\`\`

### 3. Start Services

\`\`\`bash
# Start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
\`\`\`

### 4. Access the Applications

Once services are running:

- **User Interface**: http://localhost:8080
- **Admin Interface**: http://localhost:8081
- **API Health Check**: http://localhost:3003/health

### 5. Initial Setup

1. **Create Admin Account**
   - Visit http://localhost:8081
   - Click "Register" or "Get Started"
   - Fill in your admin details
   - You'll be automatically logged in

2. **Create Your First Chatbot**
   - In the admin interface, click "Create Chatbot"
   - Give it a name (e.g., "Customer Support")
   - Configure the system prompt
   - Save the chatbot

3. **Add Knowledge Sources**
   - **Website Context**: Add URLs to crawl
   - **Documents**: Upload PDF, DOCX, or text files
   - **Nextcloud**: Connect your Nextcloud instance (optional)

4. **Test the Chatbot**
   - Visit http://localhost:8080
   - Register a user account
   - Select your chatbot
   - Start chatting!

## Installation Flow

\`\`\`mermaid
sequenceDiagram
    participant User
    participant Docker
    participant Services
    participant Database
    participant AI
    
    User->>Docker: docker-compose up
    Docker->>Database: Start PostgreSQL
    Docker->>Database: Start Weaviate
    Docker->>Services: Start Backend Services
    Services->>Database: Connect & Migrate
    Services->>AI: Verify API Keys
    Services-->>User: Services Ready
    User->>Services: Access Web Interface
\`\`\`

## Verification

Check that all services are running:

\`\`\`bash
# Check Docker containers
docker-compose ps

# Check service health
curl http://localhost:3003/health  # User Service
curl http://localhost:3002/health  # Admin Service
curl http://localhost:3001/health  # Crawling Service
curl http://localhost:3004/health  # Cron Scheduler

# Check database
docker-compose exec postgres psql -U citadel_user -d citadel_db -c "SELECT version();"

# Check Weaviate
curl http://localhost:8080/v1/.well-known/ready
\`\`\`

## Common Issues

### Services Won't Start

**Problem**: Docker containers fail to start

**Solutions:**
1. Check Docker is running: \`docker ps\`
2. Check ports are available: \`netstat -tulpn | grep -E ":(3001|3002|3003|5432|8080)"\`
3. Check logs: \`docker-compose logs [service-name]\`
4. Verify environment variables: \`cat .env\`

### Database Connection Errors

**Problem**: Services can't connect to PostgreSQL

**Solutions:**
1. Wait for database to be ready: \`docker-compose logs postgres\`
2. Check database credentials in \`.env\`
3. Verify database is running: \`docker-compose ps postgres\`

### AI Provider Errors

**Problem**: Chat responses fail with API errors

**Solutions:**
1. Verify API key is set: \`grep API_KEY .env\`
2. Check API key is valid
3. Verify you have API credits/quota
4. Check service logs: \`docker-compose logs user-backend\`

## Next Steps

- [Configuration Guide](/configuration/reference) - Detailed configuration options
- [Deployment Guide](/deployment/guide) - Production deployment
- [API Reference](/api/overview) - Complete API documentation
- [Troubleshooting](/troubleshooting/guide) - Common issues and solutions
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default GettingStarted;
