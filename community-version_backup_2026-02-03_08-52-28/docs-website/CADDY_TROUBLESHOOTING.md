# Caddy SSL Troubleshooting Guide

**Issue:** `SSL_ERROR_INTERNAL_ERROR_ALERT` when accessing `docs.citadelai.app`

---

## Quick Diagnostic Commands

### 1. Check Caddy Container Status

```bash
# Check if Caddy is running
docker ps | grep caddy

# Or with docker-compose
docker compose ps caddy
```

### 2. Check Caddy Logs

```bash
# View recent logs
docker logs caddy --tail 100

# Follow logs in real-time
docker logs caddy -f

# Filter for errors
docker logs caddy --tail 200 | grep -i error

# Filter for SSL/certificate issues
docker logs caddy --tail 200 | grep -i -E "(ssl|tls|certificate|acme|letsencrypt|docs\.citadelai)"

# Check for specific domain
docker logs caddy --tail 200 | grep "docs.citadelai.app"
```

### 3. Check docs-website Service

```bash
# Check if docs-website container is running
docker ps | grep docs-website

# Check docs-website logs
docker logs docs-website --tail 50

# Check if service is healthy
curl -I http://localhost:80  # From inside the container network
```

### 4. Verify DNS Configuration

```bash
# Check DNS resolution
dig docs.citadelai.app
nslookup docs.citadelai.app

# Check if DNS points to correct IP
host docs.citadelai.app
```

### 5. Test Internal Connectivity

```bash
# Test if Caddy can reach docs-website
docker exec caddy wget -O- http://docs-website:80/health 2>&1

# Test from host
curl -I http://localhost:80  # If exposed
```

### 6. Validate Caddyfile

```bash
# Validate Caddyfile syntax
docker exec caddy caddy validate --config /etc/caddy/Caddyfile

# Or if Caddy is not running
caddy validate --config Caddyfile
```

### 7. Check Caddy Data Directory

```bash
# Check certificate storage
docker exec caddy ls -la /data/caddy/certificates/

# Check for certificate files
docker exec caddy find /data/caddy -name "*docs.citadelai.app*"
```

---

## Common SSL Error Causes

### 1. DNS Not Pointing to Server

**Symptom:** `SSL_ERROR_INTERNAL_ERROR_ALERT` or certificate errors

**Check:**
```bash
dig docs.citadelai.app +short
# Should return your server's IP address
```

**Fix:** Update DNS A record to point to your server IP

### 2. Backend Service Not Running

**Symptom:** SSL handshake fails because backend is unreachable

**Check:**
```bash
docker ps | grep docs-website
docker logs docs-website --tail 20
```

**Fix:**
```bash
# Start the service
docker compose up -d docs-website

# Or restart
docker compose restart docs-website
```

### 3. Caddy Can't Reach Backend

**Symptom:** Connection refused errors in Caddy logs

**Check:**
```bash
# Test connectivity from Caddy container
docker exec caddy ping docs-website
docker exec caddy wget -O- http://docs-website:80/health
```

**Fix:** Ensure both containers are on the same Docker network (`citadel-net`)

### 4. Rate Limiting from Let's Encrypt

**Symptom:** Too many certificate requests

**Check:**
```bash
docker logs caddy | grep -i "rate limit\|too many"
```

**Fix:** Wait 1 hour, or use staging environment for testing

### 5. Firewall Blocking Ports

**Symptom:** Can't access domain at all

**Check:**
```bash
# Check if ports are open
sudo netstat -tulpn | grep -E ":(80|443)"
sudo ufw status
```

**Fix:** Open ports 80 and 443 in firewall

### 6. Caddyfile Configuration Error

**Symptom:** Caddy fails to start or reload

**Check:**
```bash
docker logs caddy | grep -i "error\|failed\|invalid"
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
```

**Fix:** Correct Caddyfile syntax errors

---

## Step-by-Step Debugging

### Step 1: Check Service Status

```bash
# All services should be running
docker compose ps

# Specifically check
docker compose ps caddy docs-website
```

### Step 2: Check Caddy Logs

```bash
# Get full error context
docker logs caddy --tail 100 --since 10m
```

Look for:
- Certificate acquisition errors
- Connection refused errors
- DNS resolution errors
- Backend unreachable errors

### Step 3: Test Backend Directly

```bash
# Test if docs-website responds
docker exec caddy curl -I http://docs-website:80
```

### Step 4: Check Network Connectivity

```bash
# Verify both are on same network
docker network inspect citadel-net | grep -A 5 "docs-website\|caddy"
```

### Step 5: Restart Services

```bash
# Restart docs-website
docker compose restart docs-website

# Reload Caddy (preserves connections)
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

# Or full restart
docker compose restart caddy
```

---

## Specific Fixes for docs.citadelai.app

### Fix 1: Ensure docs-website is Running

```bash
docker compose -f docker-compose.prod.yml up -d docs-website
docker compose -f docker-compose.prod.yml ps docs-website
```

### Fix 2: Verify Caddyfile Configuration

Ensure the Caddyfile has:
```caddy
docs.citadelai.app {
    reverse_proxy docs-website:80 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

### Fix 3: Reload Caddy Configuration

```bash
# Reload without restart
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

# Or restart Caddy
docker compose restart caddy
```

### Fix 4: Check DNS

```bash
# Verify DNS
dig docs.citadelai.app +short
# Should return your server IP

# If not, update DNS A record
```

### Fix 5: Force Certificate Renewal

```bash
# Delete old certificate (if corrupted)
docker exec caddy rm -rf /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/*docs.citadelai.app*

# Reload Caddy to get new certificate
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

---

## Production Server Commands

If running on production (Hetzner):

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Check Caddy logs
cd /root/CathedralAI
docker compose -f docker-compose.prod.yml logs caddy --tail 100

# Check docs-website
docker compose -f docker-compose.prod.yml logs docs-website --tail 50

# Restart services
docker compose -f docker-compose.prod.yml restart docs-website caddy

# Validate Caddyfile
docker compose -f docker-compose.prod.yml exec caddy caddy validate --config /etc/caddy/Caddyfile
```

---

## Quick Health Check Script

```bash
#!/bin/bash
echo "=== Caddy Status ==="
docker ps | grep caddy
echo ""
echo "=== docs-website Status ==="
docker ps | grep docs-website
echo ""
echo "=== Recent Caddy Errors ==="
docker logs caddy --tail 50 | grep -i error
echo ""
echo "=== DNS Check ==="
dig docs.citadelai.app +short
echo ""
echo "=== Backend Health ==="
docker exec caddy wget -qO- http://docs-website:80/health 2>&1 || echo "Backend unreachable"
```

---

## Still Not Working?

1. **Check full Caddy logs:**
   ```bash
   docker logs caddy --tail 500 > caddy-logs.txt
   # Review for specific errors
   ```

2. **Check system resources:**
   ```bash
   docker stats caddy docs-website
   ```

3. **Verify Docker network:**
   ```bash
   docker network inspect citadel-net
   ```

4. **Test with curl from server:**
   ```bash
   curl -I https://docs.citadelai.app
   curl -v https://docs.citadelai.app 2>&1 | grep -i ssl
   ```

---

**Last Updated:** 2026-01-05
