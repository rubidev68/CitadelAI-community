import re

with open('migrate_to_community.sh', 'r') as f:
    content = f.read()

# Fix 1: Stripe import regex
# Old: r'import\s+\{\s*stripe\s*\}\s+from\s+['"]\./services/stripeService['"];\n?'
# New: r"import\s+\{\s*stripe\s*\}\s+from\s+['\"]\./services/stripeService['\"];\n?"

# We'll just replace the specific problematic lines with safer versions using double quotes for the python string.

# Stripe Service
content = content.replace(r"r'import\s+\{\s*stripe\s*\}\s+from\s+['" + '"' + r"]\./services/stripeService['" + '"' + r"];\n?'", 
                          r'r"import\s+\{\s*stripe\s*\}\s+from\s+[\'\"]./services/stripeService[\'\"];\n?"')

# Slack Routes
content = content.replace(r"r'import\s+slackRoutes\s+from\s+['" + '"' + r"]\./routes/slack['" + '"' + r"];\n?'", 
                          r'r"import\s+slackRoutes\s+from\s+[\'\"]./routes/slack[\'\"];\n?"')

# Stripe Webhook
content = content.replace(r"r'import\s+\{\s*handleStripeWebhook\s*\}\s+from\s+['" + '"' + r"]\./controllers/stripe/webhookController['" + '"' + r"];\n?'", 
                          r'r"import\s+\{\s*handleStripeWebhook\s*\}\s+from\s+[\'\"]./controllers/stripe/webhookController[\'\"];\n?"')

# Also fix the `\./` escaping. Python `r''` strings treat backslashes literally.
# But inside `[]`, `.` matches literal dot anyway? No, inside `[]` it does. Outside it doesn't.
# `\./` -> `\.` matches literal dot.
# The original error was `['"]`.
# Let's just use `[\'\"]` inside `r"..."`.

# Wait, `content.replace` needs exact string match. The bash file has backslashes escaped?
# The error output showed: `r'import...['"]...`
# So let's try to match loosely or use regex substitution on the file content.

# Search for patterns like `r' ... ['"] ... '` and replace with `r" ... ['"] ... "`
# But handling the internal quotes is tricky.

# Simpler: replace `['"]` with `[\'\"]` everywhere in that file? No.

# Let's target the specific lines using unique substrings.

# 1. Stripe import
content = re.sub(r"r'import\\s\+\\+\{\\s\*stripe\\s\*\}\\\\s\+from\\s\+\[\\'\"\]\\\./services/stripeService\[\\'\"\];\\n\?'", 
                 r'r"import\\s+\\{\\s*stripe\\s*\\}\\s+from\\s+[\'\"]./services/stripeService[\'\"];\\n?"', content)

# Actually, let's just use the `restore_pypatch_index.py` logic again but with CORRECTED content.
# It is safer to rewrite the whole block.

with open('migrate_to_community.sh', 'w') as f:
    f.write(content)
print("Updated regex quotes (attempted).")
