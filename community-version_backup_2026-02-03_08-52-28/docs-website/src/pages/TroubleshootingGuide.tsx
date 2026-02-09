import MarkdownRenderer from "@/components/MarkdownRenderer";

const TroubleshootingGuide = () => {
  const content = `# Troubleshooting Guide

Common issues and solutions for CitadelAI.

## Quick Diagnostics

### Check Service Status

\`\`\`bash
# Check all containers
docker-compose ps

# Check specific service
docker-compose ps user-backend

# Check service health
curl http://localhost:3003/health
curl http://localhost:3002/health
curl http://localhost:3001/health
curl http://localhost:3004/health
\`\`\`

### Check Logs

\`\`\`bash
# All services
docker-compose logs --tail=100

# Specific service
docker-compose logs --tail=100 user-backend

# Follow logs in real-time
docker-compose logs -f user-backend

# Filter for errors
docker-compose logs user-backend | grep -i error
\`\`\`

## Common Issues

### Services Won't Start

**Symptoms:**
- Containers exit immediately
- \`docker-compose ps\` shows "Exited" status
- Services not accessible

**Diagnosis:**
\`\`\`bash
# Check container logs
docker-compose logs [service-name]

# Check if ports are in use
sudo netstat -tulpn | grep -E ":(3001|3002|3003|5432|8080)"

# Check Docker resources
docker system df
docker stats
\`\`\`

**Solutions:**
1. **Port conflicts**: Stop other services using the same ports
2. **Insufficient resources**: Increase Docker memory/CPU limits
3. **Environment variables**: Verify \`.env\` file is correct
4. **Database not ready**: Wait for database to be healthy before starting services

### Database Connection Errors

**Symptoms:**
- Services can't connect to PostgreSQL
- Error: "Connection refused" or "Connection timeout"
- Database migration failures

**Diagnosis:**
\`\`\`bash
# Check database is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test database connection
docker-compose exec postgres psql -U citadel_user -d citadel_db -c "SELECT 1;"

# Check database credentials
grep POSTGRES .env
\`\`\`

**Solutions:**
1. **Wait for database**: Database needs time to initialize
   \`\`\`bash
   # Wait and check
   docker-compose logs -f postgres
   # Look for "database system is ready to accept connections"
   \`\`\`

2. **Verify credentials**: Check \`POSTGRES_USER\`, \`POSTGRES_PASSWORD\`, \`POSTGRES_DB\` in \`.env\`

3. **Check network**: Ensure services are on same Docker network
   \`\`\`bash
   docker network inspect citadel-net
   \`\`\`

4. **Reset database** (development only):
   \`\`\`bash
   docker-compose down -v
   docker-compose up -d postgres
   # Wait for ready, then start other services
   \`\`\`

### Weaviate Connection Issues

**Symptoms:**
- Vector search not working
- Error: "Weaviate connection failed"
- Content not being indexed

**Diagnosis:**
\`\`\`bash
# Check Weaviate is running
docker-compose ps weaviate

# Check Weaviate health
curl http://localhost:8080/v1/.well-known/ready

# Check Weaviate logs
docker-compose logs weaviate

# Verify OpenAI API key for Weaviate
grep OPENAI_API_KEY .env
\`\`\`

**Solutions:**
1. **OpenAI API key required**: Weaviate needs \`OPENAI_API_KEY\` for vectorization
2. **Check Weaviate URL**: Verify \`WEAVIATE_URL\` in environment
3. **Restart Weaviate**: \`docker-compose restart weaviate\`

### AI Provider API Errors

**Symptoms:**
- Chat responses fail
- Error: "API key invalid" or "Rate limit exceeded"
- No AI responses

**Diagnosis:**
\`\`\`bash
# Check API keys are set
grep -E "(GEMINI|OPENAI|ANTHROPIC|MISTRAL)_API_KEY" .env

# Check service logs
docker-compose logs user-backend | grep -i "api\|error"

# Test API key (example for OpenAI)
curl https://api.openai.com/v1/models \\
  -H "Authorization: Bearer YOUR_OPENAI_KEY"
\`\`\`

**Solutions:**
1. **Verify API key**: Test key directly with provider API
2. **Check API quota**: Verify you have available credits
3. **Check rate limits**: Wait if rate limited
4. **Set at least one provider**: At least one AI provider key is required

### Authentication Issues

**Symptoms:**
- "Unauthorized" errors
- Token validation failures
- Can't login

**Diagnosis:**
\`\`\`bash
# Check JWT_SECRET is set
grep JWT_SECRET .env

# Check token format
# Token should be: Bearer <token>
\`\`\`

**Solutions:**
1. **Verify JWT_SECRET**: Must be set and consistent across services
2. **Check token format**: Use \`Authorization: Bearer <token>\` header
3. **Token expired**: Re-authenticate to get new token
4. **Wrong service**: User tokens for user API, admin tokens for admin API

### Crawling Service Issues

**Symptoms:**
- Crawling jobs not starting
- Crawling stuck or slow
- Content not being indexed

**Diagnosis:**
\`\`\`bash
# Check crawling service status
curl http://localhost:3001/health

# Check concurrency status
curl http://localhost:3001/concurrency-status

# Check crawling logs
docker-compose logs crawling-service

# Check specific job status
curl http://localhost:3001/status/block-123
\`\`\`

**Solutions:**
1. **Concurrency limits**: Check if max jobs/crawlers reached
2. **Network issues**: Verify target URLs are accessible
3. **Resource limits**: Increase Docker memory if crawling fails
4. **Stop stuck jobs**: \`POST /stop\` to cancel stuck crawling

### Frontend Not Loading

**Symptoms:**
- Blank page
- 404 errors
- Assets not loading

**Diagnosis:**
\`\`\`bash
# Check frontend containers
docker-compose ps user-frontend admin-frontend

# Check frontend logs
docker-compose logs user-frontend
docker-compose logs admin-frontend

# Check browser console for errors
# Open DevTools (F12) and check Console tab
\`\`\`

**Solutions:**
1. **Rebuild frontend**: \`docker-compose up -d --build user-frontend\`
2. **Check environment variables**: Frontend may need API URLs
3. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
4. **Check CORS**: Verify API URLs match frontend configuration

## Performance Issues

### Slow Response Times

**Diagnosis:**
\`\`\`bash
# Check resource usage
docker stats

# Check database performance
docker-compose exec postgres psql -U citadel_user -d citadel_db -c "SELECT * FROM pg_stat_activity;"

# Check service logs for slow queries
docker-compose logs user-backend | grep -i "slow\|timeout"
\`\`\`

**Solutions:**
1. **Increase resources**: More CPU/RAM for Docker
2. **Database optimization**: Add indexes, optimize queries
3. **Connection pooling**: Adjust pool settings
4. **Cache frequently accessed data**: Use Redis if available

### High Memory Usage

**Diagnosis:**
\`\`\`bash
# Check memory usage
docker stats

# Check specific service
docker stats user-backend admin-backend
\`\`\`

**Solutions:**
1. **Increase Docker memory limit**: Docker Desktop → Settings → Resources
2. **Restart services**: \`docker-compose restart\`
3. **Check for memory leaks**: Monitor over time
4. **Scale services**: Run multiple instances

## SSL/HTTPS Issues

### Certificate Problems

**Symptoms:**
- SSL errors in browser
- Certificate not trusted
- HTTPS not working

**Diagnosis:**
\`\`\`bash
# Check Caddy logs
docker-compose logs caddy | grep -i "certificate\|ssl\|tls"

# Check DNS
dig citadelai.app
nslookup api.citadelai.app

# Test SSL
curl -I https://citadelai.app
\`\`\`

**Solutions:**
1. **DNS not propagated**: Wait up to 48 hours for DNS
2. **Ports not open**: Ensure ports 80 and 443 are open
3. **Rate limiting**: Let's Encrypt has rate limits, wait if exceeded
4. **Check Caddyfile**: Verify domain configuration

## Data Issues

### Database Migration Failures

**Symptoms:**
- Services fail to start
- Database schema errors
- Migration errors in logs

**Solutions:**
\`\`\`bash
# Check migration service logs
docker-compose logs db-migration-service

# Manually run migrations (if needed)
docker-compose exec admin-backend npx prisma migrate deploy

# Reset database (development only)
docker-compose down -v
docker-compose up -d
\`\`\`

### Missing Data

**Symptoms:**
- Chatbots not appearing
- Users not found
- Content not indexed

**Diagnosis:**
\`\`\`bash
# Check database
docker-compose exec postgres psql -U citadel_user -d citadel_db -c "SELECT COUNT(*) FROM chatbots;"

# Check Weaviate
curl http://localhost:8080/v1/objects
\`\`\`

**Solutions:**
1. **Verify data exists**: Check database directly
2. **Check permissions**: Verify user has access
3. **Re-index content**: Re-run crawling if needed
4. **Check filters**: Verify query filters are correct

## Network Issues

### Services Can't Communicate

**Symptoms:**
- Internal service calls fail
- Connection refused errors

**Diagnosis:**
\`\`\`bash
# Check Docker network
docker network inspect citadel-net

# Test connectivity
docker-compose exec user-backend ping admin-backend
docker-compose exec user-backend curl http://admin-backend:3002/health
\`\`\`

**Solutions:**
1. **Verify network**: All services must be on \`citadel-net\`
2. **Check service names**: Use Docker service names, not localhost
3. **Restart network**: \`docker network prune\` then restart services

### Port Conflicts

**Symptoms:**
- Services fail to start
- "Port already in use" errors

**Solutions:**
\`\`\`bash
# Find process using port
sudo lsof -i :3003
sudo netstat -tulpn | grep 3003

# Kill process (if safe)
sudo kill -9 <PID>

# Or change port in docker-compose.yml
\`\`\`

## Getting Help

### Collect Diagnostic Information

\`\`\`bash
# System information
docker --version
docker-compose --version
uname -a

# Service status
docker-compose ps > service-status.txt

# Recent logs
docker-compose logs --tail=200 > logs.txt

# Environment (remove secrets!)
grep -v "PASSWORD\\|SECRET\\|KEY" .env > env-safe.txt
\`\`\`

### Useful Commands

\`\`\`bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart user-backend

# View resource usage
docker stats

# Clean up
docker system prune -a

# Check disk space
df -h
docker system df
\`\`\`

## Prevention

### Regular Maintenance

1. **Monitor logs**: Check logs regularly for warnings
2. **Backup database**: Regular backups of PostgreSQL
3. **Update dependencies**: Keep Docker and images updated
4. **Monitor resources**: Watch CPU, memory, disk usage
5. **Test health checks**: Regularly verify service health

### Best Practices

1. **Use health checks**: All services should have health endpoints
2. **Proper error handling**: Services should handle errors gracefully
3. **Logging**: Use structured logging for easier debugging
4. **Monitoring**: Set up monitoring and alerts
5. **Documentation**: Keep configuration documented

## Next Steps

- [Getting Started](/getting-started) - Initial setup
- [Configuration Reference](/configuration/reference) - Environment variables
- [Deployment Guide](/deployment/guide) - Production deployment
- [API Reference](/api/overview) - API documentation
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default TroubleshootingGuide;
