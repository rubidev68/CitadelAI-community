#!/bin/sh
set -e

# Generate config.js from environment variables
cat > /usr/share/nginx/html/config.js <<EOF
// Runtime configuration injected from environment variables
window.__ENV__ = {
  ADMIN_API_URL: '${ADMIN_API_URL:-}',
  USER_API_URL: '${USER_API_URL:-}',
  USER_INTERFACE_URL: '${USER_INTERFACE_URL:-}',
  FEATURE_BILLING: '${FEATURE_BILLING:-true}',
  FEATURE_ENTERPRISE: '${FEATURE_ENTERPRISE:-true}',
  FEATURE_ADVANCED_ANALYTICS: '${FEATURE_ADVANCED_ANALYTICS:-true}',
  FEATURE_PREMIUM_AI_MODELS: '${FEATURE_PREMIUM_AI_MODELS:-true}',
  FEATURE_ADMINJS_DASHBOARD: '${FEATURE_ADMINJS_DASHBOARD:-true}'
};
EOF

# Start nginx
exec nginx -g "daemon off;"
