# Log Viewing Scripts

Quick reference for viewing logs in CitadelAI.

## Quick Commands

```bash
# Pretty-print logs for a service (recommended)
./scripts/view-logs.sh -c docker-compose.prod.yml user-backend

# Follow logs in real-time
./scripts/view-logs.sh -c docker-compose.prod.yml -f user-backend

# View only errors
./scripts/view-logs.sh -c docker-compose.prod.yml -l ERROR user-backend

# View all services
./scripts/view-logs.sh -c docker-compose.prod.yml -f
```

## Installation

The scripts require:
- `docker-compose` (already installed)
- `jq` (optional, for better JSON parsing in bash script)

Install jq:
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq

# Or use the Node.js script which doesn't require jq
node scripts/view-logs.js user-backend
```

## Examples

```bash
# View last 50 lines
./scripts/view-logs.sh -c docker-compose.prod.yml -n 50 user-backend

# Follow and filter errors
./scripts/view-logs.sh -c docker-compose.prod.yml -f -l ERROR user-backend

# View with JSON parsing
./scripts/view-logs.sh -c docker-compose.prod.yml -j user-backend
```
