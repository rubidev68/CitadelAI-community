import re

with open('migrate_to_community.sh', 'r') as f:
    content = f.read()

# We want to replace the `PYPATCH_INDEX` block with a version that uses `r"..."` strings
# to avoid syntax errors with `'` inside the regex.

old_block_start = "DEST_DIR=\"$DEST_DIR\" python3 << 'PYPATCH_INDEX'"
old_block_end = "PYPATCH_INDEX"

# New block content
new_block = r"""DEST_DIR="$DEST_DIR" python3 << 'PYPATCH_INDEX'
import os
import re

dest = os.environ.get('DEST_DIR', '')
if not dest:
    raise SystemExit(0)

# Patch index.ts
index_path = os.path.join(dest, 'admin/backend/src/index.ts')
if os.path.exists(index_path):
    with open(index_path, 'r') as f:
        content = f.read()
    
    # Remove imports (Using r"..." to handle quotes inside regex)
    content = re.sub(r"import\s+\{\s*stripe\s*\}\s+from\s+['\"]\./services/stripeService['\"];\n?", '', content)
    content = re.sub(r"import\s+slackRoutes\s+from\s+['\"]\./routes/slack['\"];\n?", '', content)
    
    # Remove Slack route mounting
    content = re.sub(r"app\.use\('/api/admin/slack',\s*slackRoutes\);\n?", '', content)
    content = re.sub(r"app\.use\('/api/admin',\s*slackRoutes\);\n?", '', content)
    
    with open(index_path, 'w') as f:
        f.write(content)

# Patch app.ts
app_path = os.path.join(dest, 'admin/backend/src/app.ts')
if os.path.exists(app_path):
    with open(app_path, 'r') as f:
        content = f.read()
    
    # Remove Stripe Webhook Controller import
    content = re.sub(r"import\s+\{\s*handleStripeWebhook\s*\}\s+from\s+['\"]\./controllers/stripe/webhookController['\"];\n?", '', content)
    
    # Remove usage
    content = re.sub(r"app\.post\(\s*'/api/admin/stripe/webhook',\s*express\.raw\(\{ type: 'application/json' \}\),\s*handleStripeWebhook\s*\);\n?", '', content)
    
    # Remove Slack webhook routes
    content = re.sub(r"app\.post\(\s*'/api/admin/slack/events',[\s\S]+?\}\n\s*\);\n", '', content)
    content = re.sub(r"app\.post\(\s*'/api/admin/slack/interactive',[\s\S]+?\}\n\s*\);\n", '', content)

    with open(app_path, 'w') as f:
        f.write(content)
PYPATCH_INDEX"""

# Find start
start_idx = content.find(old_block_start)
if start_idx != -1:
    # Find end (first occurrence after start)
    end_idx = content.find(old_block_end, start_idx + len(old_block_start))
    if end_idx != -1:
        end_idx += len(old_block_end)
        
        # Replace
        content = content[:start_idx] + new_block + content[end_idx:]
        
        with open('migrate_to_community.sh', 'w') as f:
            f.write(content)
        print("Replaced PYPATCH_INDEX block with quote-safe version.")
    else:
        print("Could not find end of PYPATCH_INDEX block.")
else:
    print("Could not find start of PYPATCH_INDEX block.")
