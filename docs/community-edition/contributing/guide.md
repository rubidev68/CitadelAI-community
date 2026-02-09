# Contributing Guide

**Purpose:** Guide for contributors to the Community Edition

---

## Getting Started

1. **Fork the Repository**
   ```bash
   git clone https://github.com/your-org/citadelai-community.git
   cd citadelai-community
   ```

2. **Set Up Development Environment**
   ```bash
   npm install
   docker-compose -f docker-compose.opensource.yml up -d
   ```

3. **Make Changes**
   - Create a feature branch
   - Make your changes
   - Test thoroughly
   - Ensure no business traces

4. **Submit Pull Request**
   - CI/CD will validate
   - Ensure all checks pass
   - Get code review

---

## Code Guidelines

### What NOT to Include

- ❌ No Stripe/subscription code
- ❌ No email service code
- ❌ No proprietary integrations (Slack, Teams, GDrive, OneDrive)
- ❌ No business-specific features

### What to Include

- ✅ Open-source compatible code
- ✅ Nextcloud integration (open-source)
- ✅ Core functionality improvements
- ✅ Bug fixes
- ✅ Documentation improvements

---

## Validation

Before submitting PR:

```bash
# Run validation
./scripts/validate-community-edition.sh

# Ensure it passes
```

---

**Last Updated:** 2026-01-05
