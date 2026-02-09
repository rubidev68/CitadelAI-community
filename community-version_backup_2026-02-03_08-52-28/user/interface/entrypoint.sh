#!/bin/sh
set -e

# Generate config.js from environment variables
cat > /usr/share/nginx/html/config.js <<EOF
// Runtime configuration injected from environment variables
window.__ENV__ = {
  CATHEDRAL_API_URL: '${CATHEDRAL_API_URL:-}',
  API_URL: '${API_URL:-}',
  WS_URL: '${WS_URL:-}'
};
EOF

# Start nginx
exec nginx -g "daemon off;"
