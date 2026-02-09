import MarkdownRenderer from "@/components/MarkdownRenderer";

const DeploymentGuide = () => {
  const content = `# Deployment Guide

Complete guide for deploying CitadelAI to production.

## Deployment Overview

CitadelAI can be deployed using Docker Compose, which is the recommended approach for most deployments.

\`\`\`mermaid
graph TB
    subgraph "Production Server"
        A[Caddy Reverse Proxy]
        B[Docker Compose]
        C[Services]
        D[PostgreSQL]
        E[Weaviate]
    end
    
    subgraph "External"
        F[Domain DNS]
        G[SSL Certificates]
        H[AI Providers]
    end
    
    F --> A
    A --> B
    B --> C
    C --> D
    C --> E
    C --> H
    A -.-> G
\`\`\`

## Prerequisites

### Server Requirements

- **OS**: Linux (Ubuntu 20.04+ recommended)
- **Docker**: >= 20.0.0
- **Docker Compose**: >= 2.0.0
- **RAM**: 16 GB minimum (32 GB recommended)
- **CPU**: 8 cores minimum
- **Storage**: 100 GB SSD minimum
- **Network**: Static IP address

### Domain Configuration

1. **Point DNS to your server:**
   - \`A\` record: \`citadelai.app\` → Your server IP
   - \`A\` record: \`api.citadelai.app\` → Your server IP
   - \`A\` record: \`admin.citadelai.app\` → Your server IP
   - \`A\` record: \`chat.citadelai.app\` → Your server IP
   - \`A\` record: \`docs.citadelai.app\` → Your server IP

2. **Wait for DNS propagation** (can take up to 48 hours)

## Production Deployment Steps

### 1. Prepare Server

\`\`\`bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
\`\`\`

### 2. Clone Repository

\`\`\`bash
git clone https://github.com/rubidev68/citadelai-community.git
cd citadelai-community
\`\`\`

### 3. Configure Environment

\`\`\`bash
# Copy production template
cp prod.env.template .env

# Edit with your values
nano .env
\`\`\`

**Required variables:**
- AI provider API keys
- Database credentials
- JWT secret
- Domain URLs
- Service URLs

### 4. Build and Push Images

\`\`\`bash
# Build all images
./scripts/build-and-push.sh

# Or build individually
docker build -t your-registry/citadelai/user-backend:latest ./user/backend
docker build -t your-registry/citadelai/admin-backend:latest ./admin/backend
# ... etc
\`\`\`

### 5. Start Services

\`\`\`bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
\`\`\`

### 6. Verify Deployment

\`\`\`bash
# Check all services are healthy
curl https://api.citadelai.app/health
curl https://admin.citadelai.app
curl https://chat.citadelai.app
curl https://docs.citadelai.app

# Check SSL certificates
curl -I https://citadelai.app
\`\`\`

## Docker Compose Production Configuration

### Service Dependencies

\`\`\`mermaid
graph LR
    A[Caddy] --> B[PostgreSQL]
    A --> C[Weaviate]
    A --> D[User Backend]
    A --> E[Admin Backend]
    A --> F[Crawling Service]
    A --> G[Cron Scheduler]
    A --> H[User Frontend]
    A --> I[Admin Frontend]
    A --> J[Docs Website]
    
    D --> B
    D --> C
    E --> B
    E --> C
    F --> B
    F --> C
    G --> B
    G --> C
\`\`\`

### Health Checks

All services include health checks:

\`\`\`yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
\`\`\`

## SSL/TLS Configuration

Caddy automatically handles SSL certificates via Let's Encrypt:

1. **DNS must point to server** before starting
2. **Ports 80 and 443** must be open
3. **Caddy will automatically** obtain and renew certificates

### Manual SSL (if needed)

If using a different reverse proxy:

\`\`\`bash
# Generate certificates with certbot
sudo certbot certonly --standalone -d citadelai.app -d api.citadelai.app

# Certificates location
/etc/letsencrypt/live/citadelai.app/fullchain.pem
/etc/letsencrypt/live/citadelai.app/privkey.pem
\`\`\`

## Database Setup

### Initial Migration

Database migrations run automatically on first start:

\`\`\`bash
# Check migration service
docker-compose -f docker-compose.prod.yml logs db-migration-service

# Verify migrations completed
docker-compose -f docker-compose.prod.yml exec postgres psql -U citadel_user -d citadel_db -c "\\dt"
\`\`\`

### Database Backups

\`\`\`bash
# Create backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U citadel_user citadel_db > backup_\$(date +%Y%m%d).sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U citadel_user citadel_db < backup_20250101.sql
\`\`\`

## Monitoring

### Health Checks

All services expose health endpoints:

- User Backend: \`GET /health\`
- Admin Backend: \`GET /health\`
- Crawling Service: \`GET /health\`
- Cron Scheduler: \`GET /health\`

### Logs

\`\`\`bash
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service
docker-compose -f docker-compose.prod.yml logs -f user-backend

# View last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100
\`\`\`

### Resource Monitoring

\`\`\`bash
# Check resource usage
docker stats

# Check disk usage
df -h
docker system df

# Check service status
docker-compose -f docker-compose.prod.yml ps
\`\`\`

## Scaling

### Horizontal Scaling

Services can be scaled independently:

\`\`\`bash
# Scale user backend
docker-compose -f docker-compose.prod.yml up -d --scale user-backend=3

# Scale crawling service
docker-compose -f docker-compose.prod.yml up -d --scale crawling-service=2
\`\`\`

**Note:** Database and Weaviate should remain single instance unless using clustering.

### Vertical Scaling

Increase resources:
- **RAM**: Increase Docker memory limits
- **CPU**: Allocate more CPU cores
- **Storage**: Expand volumes

## Updates and Maintenance

### Updating Services

\`\`\`bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Restart services
docker-compose -f docker-compose.prod.yml up -d

# Or rebuild
docker-compose -f docker-compose.prod.yml up -d --build
\`\`\`

### Zero-Downtime Updates

\`\`\`bash
# Update one service at a time
docker-compose -f docker-compose.prod.yml up -d --no-deps user-backend
# Wait for health check
docker-compose -f docker-compose.prod.yml up -d --no-deps admin-backend
# Continue for other services
\`\`\`

## Security Considerations

### Firewall Configuration

\`\`\`bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
\`\`\`

### Secrets Management

- **Never commit \`.env\` files**
- **Use secrets management** (Docker secrets, HashiCorp Vault, etc.)
- **Rotate credentials regularly**
- **Use strong passwords**

### Network Security

- Services communicate via Docker network (isolated)
- Only Caddy is exposed to internet
- Internal services not directly accessible

## Troubleshooting Deployment

### Services Not Starting

\`\`\`bash
# Check logs
docker-compose -f docker-compose.prod.yml logs [service-name]

# Check resource limits
docker stats

# Check port conflicts
sudo netstat -tulpn | grep -E ":(80|443|3001|3002|3003)"
\`\`\`

### SSL Certificate Issues

\`\`\`bash
# Check Caddy logs
docker-compose -f docker-compose.prod.yml logs caddy

# Verify DNS
dig citadelai.app
nslookup api.citadelai.app

# Check firewall
sudo ufw status
\`\`\`

### Database Connection Issues

\`\`\`bash
# Check database is running
docker-compose -f docker-compose.prod.yml ps postgres

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U citadel_user -d citadel_db -c "SELECT 1;"
\`\`\`

## Production Checklist

Before going live:

- [ ] All environment variables configured
- [ ] DNS records pointing to server
- [ ] SSL certificates obtained
- [ ] Database migrations completed
- [ ] All services healthy
- [ ] Backups configured
- [ ] Monitoring set up
- [ ] Firewall configured
- [ ] Secrets secured
- [ ] Documentation updated

## Next Steps

- [Configuration Reference](/configuration/reference) - Environment variables
- [Troubleshooting Guide](/troubleshooting/guide) - Common issues
- [Services Overview](/services/overview) - Service architecture
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default DeploymentGuide;
