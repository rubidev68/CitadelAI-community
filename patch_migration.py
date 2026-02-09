import sys
import os

# Argument Parsing logic to insert at top
arg_parsing = """#!/bin/bash
set -e

# Argument Parsing
TEST_BUILD=false
PUSH_IMAGES=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --test-build) TEST_BUILD=true ;;
        --push) PUSH_IMAGES=true ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

"""

with open('migrate_to_community.sh', 'r') as f:
    lines = f.readlines()

# Check if argument parsing is already there (from my previous failed edit attempts that partially succeeded)
if "TEST_BUILD=false" in "".join(lines[:20]):
    # Argument parsing exists, just strip the shebang/set -e lines from arg_parsing
    arg_parsing = "" 
else:
    # Need to replace the shebang line if it exists
    if lines[0].startswith("#!"):
        lines.pop(0)
    if lines[0].strip() == "set -e":
        lines.pop(0)
    # Insert at top
    # We will prepend later

new_lines = []
skip = False
readme_skip = False

# New content for docker-compose
docker_compose_dev = """# Create docker-compose.dev.yml (Community Edition: Local Build)
cat > "$DEST_DIR/docker-compose.dev.yml" << 'EOF'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-cathedral}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - app-network

  weaviate:
    command:
      - --host
      - 0.0.0.0
      - --port
      - '8080'
      - --scheme
      - http
    image: semitechnologies/weaviate:1.24.1
    ports:
      - 8080:8080
      - 50051:50051
    volumes:
      - weaviate_data:/var/lib/weaviate
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
      DEFAULT_VECTORIZER_MODULE: 'none'
      ENABLE_MODULES: ''
      CLUSTER_HOSTNAME: 'node1'
    networks:
      - app-network

  admin-backend:
    image: ghcr.io/rubidev68/citadelai-community/admin-backend:latest
    build:
      context: .
      dockerfile: admin/backend/Dockerfile
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_HOST=postgres
      - DATABASE_URL=postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-cathedral}?schema=public
      - POSTGRES_USER=${DB_USER:-postgres}
      - POSTGRES_PASSWORD=${DB_PASSWORD:-postgres}
      - POSTGRES_DB=${DB_NAME:-cathedral}
      - REDIS_URL=redis://redis:6379
      - WEAVIATE_HOST=weaviate:8080
      - WEAVIATE_SCHEME=http
      - EDITION=community
      - VERSION_TYPE=opensource
      - FEATURE_BILLING=false
      - FEATURE_ENTERPRISE=false
      - FEATURE_ADVANCED_ANALYTICS=false
      - FEATURE_PREMIUM_AI_MODELS=false
      - FEATURE_ADMINJS_DASHBOARD=false
      - JWT_SECRET=${JWT_SECRET:-change_me_in_production_min_32_chars_long}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY:-0000000000000000000000000000000000000000000000000000000000000000}
      - SUPERADMIN_JWT_SECRET=${SUPERADMIN_JWT_SECRET:-community_superadmin_jwt_secret_placeholder_32ch}
      - ADMINJS_SESSION_SECRET=${ADMINJS_SESSION_SECRET:-community_adminjs_session_secret_placeholder}
      - ADMINJS_COOKIE_SECRET=${ADMINJS_COOKIE_SECRET:-community_adminjs_cookie_secret_placeholder}
      - INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN:-community_internal_service_token_placeholder}
      - SLACK_ENCRYPTION_KEY=${SLACK_ENCRYPTION_KEY:-0000000000000000000000000000000000000000000000000000000000000000}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
      weaviate:
        condition: service_started
    ports:
      - "3001:3001"
    networks:
      - app-network

  user-backend:
    image: ghcr.io/rubidev68/citadelai-community/user-backend:latest
    build:
      context: .
      dockerfile: user/backend/Dockerfile
    environment:
      - NODE_ENV=production
      - PORT=3002
      - DB_HOST=postgres
      - DATABASE_URL=postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-cathedral}?schema=public
      - POSTGRES_USER=${DB_USER:-postgres}
      - POSTGRES_PASSWORD=${DB_PASSWORD:-postgres}
      - POSTGRES_DB=${DB_NAME:-cathedral}
      - CRAWLING_SERVICE_URL=http://crawling-service:3003
      - EDITION=community
      - VERSION_TYPE=opensource
      - JWT_SECRET=${JWT_SECRET:-change_me_in_production_min_32_chars_long}
    depends_on:
      postgres:
        condition: service_healthy
      crawling-service:
        condition: service_started
    ports:
      - "3002:3002"
    networks:
      - app-network

  crawling-service:
    image: ghcr.io/rubidev68/citadelai-community/crawling-service:latest
    build:
      context: ./crawling-service
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - PORT=3003
      - REDIS_URL=redis://redis:6379
      - WEAVIATE_URL=http://weaviate:8080
      - WEAVIATE_SCHEME=http
    depends_on:
      redis:
        condition: service_started
      weaviate:
        condition: service_started
    ports:
      - "3003:3003"
    networks:
      - app-network

  cron-scheduler:
    image: ghcr.io/rubidev68/citadelai-community/cron-scheduler:latest
    build:
      context: ./cron-scheduler
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-cathedral}?schema=public
      - CRAWLING_SERVICE_URL=http://crawling-service:3003
    depends_on:
      postgres:
        condition: service_healthy
      crawling-service:
        condition: service_started
    networks:
      - app-network

  admin-frontend:
    image: ghcr.io/rubidev68/citadelai-community/admin-frontend:latest
    build:
      context: ./admin/interface
      dockerfile: Dockerfile
      args:
        - VITE_VERSION_TYPE=opensource
        - VITE_FEATURE_BILLING=false
        - VITE_FEATURE_ENTERPRISE=false
        - VITE_FEATURE_ADVANCED_ANALYTICS=false
        - VITE_FEATURE_PREMIUM_AI_MODELS=false
        - VITE_FEATURE_ADMINJS_DASHBOARD=false
    ports:
      - "3000:80"
    environment:
      - ADMIN_API_URL=http://localhost:3001/api/admin
      - USER_API_URL=http://localhost:3002/api
      - USER_INTERFACE_URL=http://localhost:4000
      - NEXT_PUBLIC_API_URL=http://localhost:3001
      - VERSION_TYPE=opensource
      - FEATURE_BILLING=false
      - FEATURE_ENTERPRISE=false
      - FEATURE_ADVANCED_ANALYTICS=false
      - FEATURE_PREMIUM_AI_MODELS=false
      - FEATURE_ADMINJS_DASHBOARD=false
    networks:
      - app-network

  user-frontend:
    image: ghcr.io/rubidev68/citadelai-community/user-frontend:latest
    build:
      context: ./user/interface
      dockerfile: Dockerfile
    ports:
      - "4000:80"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3002
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  weaviate_data:
EOF
"""

docker_compose_prod = """# Create docker-compose.yml (Community Edition: Production/Pull)
cat > "$DEST_DIR/docker-compose.yml" << 'EOF'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-cathedral}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - app-network

  weaviate:
    command:
      - --host
      - 0.0.0.0
      - --port
      - '8080'
      - --scheme
      - http
    image: semitechnologies/weaviate:1.24.1
    ports:
      - 8080:8080
      - 50051:50051
    volumes:
      - weaviate_data:/var/lib/weaviate
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
      DEFAULT_VECTORIZER_MODULE: 'none'
      ENABLE_MODULES: ''
      CLUSTER_HOSTNAME: 'node1'
    networks:
      - app-network

  admin-backend:
    image: ghcr.io/rubidev68/citadelai-community/admin-backend:latest
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_HOST=postgres
      - DATABASE_URL=postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-cathedral}?schema=public
      - POSTGRES_USER=${DB_USER:-postgres}
      - POSTGRES_PASSWORD=${DB_PASSWORD:-postgres}
      - POSTGRES_DB=${DB_NAME:-cathedral}
      - REDIS_URL=redis://redis:6379
      - WEAVIATE_HOST=weaviate:8080
      - WEAVIATE_SCHEME=http
      - EDITION=community
      - VERSION_TYPE=opensource
      - FEATURE_BILLING=false
      - FEATURE_ENTERPRISE=false
      - FEATURE_ADVANCED_ANALYTICS=false
      - FEATURE_PREMIUM_AI_MODELS=false
      - FEATURE_ADMINJS_DASHBOARD=false
      - JWT_SECRET=${JWT_SECRET:-change_me_in_production_min_32_chars_long}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY:-0000000000000000000000000000000000000000000000000000000000000000}
      - SUPERADMIN_JWT_SECRET=${SUPERADMIN_JWT_SECRET:-community_superadmin_jwt_secret_placeholder_32ch}
      - ADMINJS_SESSION_SECRET=${ADMINJS_SESSION_SECRET:-community_adminjs_session_secret_placeholder}
      - ADMINJS_COOKIE_SECRET=${ADMINJS_COOKIE_SECRET:-community_adminjs_cookie_secret_placeholder}
      - INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN:-community_internal_service_token_placeholder}
      - SLACK_ENCRYPTION_KEY=${SLACK_ENCRYPTION_KEY:-0000000000000000000000000000000000000000000000000000000000000000}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
      weaviate:
        condition: service_started
    ports:
      - "3001:3001"
    networks:
      - app-network

  user-backend:
    image: ghcr.io/rubidev68/citadelai-community/user-backend:latest
    environment:
      - NODE_ENV=production
      - PORT=3002
      - DB_HOST=postgres
      - DATABASE_URL=postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-cathedral}?schema=public
      - POSTGRES_USER=${DB_USER:-postgres}
      - POSTGRES_PASSWORD=${DB_PASSWORD:-postgres}
      - POSTGRES_DB=${DB_NAME:-cathedral}
      - CRAWLING_SERVICE_URL=http://crawling-service:3003
      - EDITION=community
      - VERSION_TYPE=opensource
      - JWT_SECRET=${JWT_SECRET:-change_me_in_production_min_32_chars_long}
    depends_on:
      postgres:
        condition: service_healthy
      crawling-service:
        condition: service_started
    ports:
      - "3002:3002"
    networks:
      - app-network

  crawling-service:
    image: ghcr.io/rubidev68/citadelai-community/crawling-service:latest
    environment:
      - NODE_ENV=production
      - PORT=3003
      - REDIS_URL=redis://redis:6379
      - WEAVIATE_URL=http://weaviate:8080
      - WEAVIATE_SCHEME=http
    depends_on:
      redis:
        condition: service_started
      weaviate:
        condition: service_started
    ports:
      - "3003:3003"
    networks:
      - app-network

  cron-scheduler:
    image: ghcr.io/rubidev68/citadelai-community/cron-scheduler:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-cathedral}?schema=public
      - CRAWLING_SERVICE_URL=http://crawling-service:3003
    depends_on:
      postgres:
        condition: service_healthy
      crawling-service:
        condition: service_started
    networks:
      - app-network

  admin-frontend:
    image: ghcr.io/rubidev68/citadelai-community/admin-frontend:latest
    ports:
      - "3000:80"
    environment:
      - ADMIN_API_URL=http://localhost:3001/api/admin
      - USER_API_URL=http://localhost:3002/api
      - USER_INTERFACE_URL=http://localhost:4000
      - NEXT_PUBLIC_API_URL=http://localhost:3001
      - VERSION_TYPE=opensource
      - FEATURE_BILLING=false
      - FEATURE_ENTERPRISE=false
      - FEATURE_ADVANCED_ANALYTICS=false
      - FEATURE_PREMIUM_AI_MODELS=false
      - FEATURE_ADMINJS_DASHBOARD=false
    networks:
      - app-network

  user-frontend:
    image: ghcr.io/rubidev68/citadelai-community/user-frontend:latest
    ports:
      - "4000:80"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3002
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  weaviate_data:
EOF
"""

# New content for README
readme_content = """# Create Community README
cat > "$DEST_DIR/README.md" << 'EOF'
# CitadelAI Community Edition

CitadelAI Community Edition is an open-source, AI-powered chatbot platform that allows you to create, manage, and deploy intelligent agents with ease.

## 🚀 Features

*   **Visual Block Editor:** Drag-and-drop interface to build chatbot logic.
*   **Multi-Model Support:** Connect with OpenAI, Anthropic, Gemini, and Mistral.
*   **Web Crawling:** Built-in crawler to ingest website content for RAG.
*   **Role-Based Access:** Standard user and admin management.
*   **Open Source:** Self-hosted and free to use.

## 🛠 Prerequisites

*   Docker & Docker Compose
*   Git

## 🏁 Quick Start

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/rubidev68/citadelai-community.git
    cd citadelai-community
    ```

2.  **Configure environment:**
    ```bash
    cp .env.example .env
    # Edit .env to add your AI API keys and change secrets
    ```

3.  **Start the platform (using pre-built images):**
    ```bash
    docker-compose up -d
    ```

    **Or build from source (dev mode):**
    ```bash
    docker-compose -f docker-compose.dev.yml up -d --build
    ```

4.  **Access the interfaces:**
    *   **Admin Dashboard:** http://localhost:3000
    *   **User Chat Interface:** http://localhost:4000

## 📚 Documentation

For full documentation, visit [docs.cathedralai.app](https://docs.cathedralai.app).

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

Apache 2.0
EOF
"""

for line in lines:
    if "Create docker-compose.yml (Community Edition: root build context" in line:
        skip = True
        new_lines.append(docker_compose_dev)
        new_lines.append('\n')
        new_lines.append(docker_compose_prod)
    elif skip and "# Create .env.example" in line:
        skip = False
        new_lines.append(line)
    elif skip:
        continue
    elif "Create Community README" in line:
        readme_skip = True
        new_lines.append(readme_content)
    elif readme_skip and "# Remove all markdown files" in line:
        readme_skip = False
        new_lines.append(line)
    elif readme_skip:
        continue
    else:
        new_lines.append(line)

if arg_parsing:
    new_lines.insert(0, arg_parsing)

# Add Build/Push logic at the end
build_push_logic = """
# Build and Push logic (if flags provided)
if [ "$TEST_BUILD" = true ]; then
    echo -e "${GREEN}Testing build with docker-compose.dev.yml...${NC}"
    # Change to destination directory for build
    cd "$DEST_DIR"
    if docker compose -f docker-compose.dev.yml build; then
        echo -e "${GREEN}Build successful!${NC}"
        
        if [ "$PUSH_IMAGES" = true ]; then
            echo -e "${GREEN}Pushing images to registry...${NC}"
            # Check for credentials
            if [ -n "$GITHUB_USERNAME" ] && [ -n "$GITHUB_TOKEN" ]; then
                echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
                docker compose -f docker-compose.dev.yml push
            else
                echo -e "${YELLOW}Warning: GITHUB_USERNAME and GITHUB_TOKEN not set. Skipping push.${NC}"
            fi
        fi
    else
        echo -e "${RED}Build failed!${NC}"
        exit 1
    fi
    # Return to original directory
    cd "$SOURCE_DIR"
fi
"""

# Check if build logic already exists
exists = False
for line in new_lines:
    if "Testing build with docker-compose.dev.yml" in line:
        exists = True
        break

if not exists:
    # Find where to insert build logic (before final echo)
    final_echo_idx = -1
    for i in range(len(new_lines)-1, -1, -1):
        if "Migration complete!" in new_lines[i]:
            final_echo_idx = i
            break

    if final_echo_idx != -1:
        new_lines.insert(final_echo_idx, build_push_logic)
    else:
        new_lines.append(build_push_logic)

with open('migrate_to_community.sh', 'w') as f:
    f.writelines(new_lines)

os.chmod('migrate_to_community.sh', 0o755)
