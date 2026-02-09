import MarkdownRenderer from "@/components/MarkdownRenderer";

const ContributingGuide = () => {
  const content = `# Contributing Guide

**Purpose:** Guide for contributors to CitadelAI

CitadelAI is an open-source project. All contributions should be open-source compatible and follow our code guidelines.

## Getting Started

1. **Fork the Repository**
   \`\`\`bash
   git clone https://github.com/rubidev68/citadelai-community.git
   cd citadelai-community
   \`\`\`

2. **Set Up Development Environment**
   \`\`\`bash
   npm install
   docker-compose up -d
   \`\`\`

3. **Make Changes**
   - Create a feature branch
   - Make your changes
   - Test thoroughly
   - Follow code style guidelines

4. **Submit Pull Request**
   - CI/CD will validate
   - Ensure all checks pass
   - Get code review

## Code Guidelines

### What to Include

- ✅ Open-source compatible code
- ✅ Nextcloud integration (open-source)
- ✅ Core functionality improvements
- ✅ Bug fixes
- ✅ Documentation improvements
- ✅ Test coverage

### ❌ What is FORBIDDEN to Develop

**IMPORTANT:** The following features exist in the Business Edition and are **FORBIDDEN** to develop in the open-source version:

#### Forbidden Integrations
- ❌ **Slack Integration** - Already exists in Business Edition
- ❌ **Microsoft Teams Integration** - Already exists in Business Edition
- ❌ **Google Drive Integration** - Already exists in Business Edition
- ❌ **OneDrive Integration** - Already exists in Business Edition

#### Forbidden Services
- ❌ **Email Service** - Already exists in Business Edition
- ❌ **Subscription/Billing System** - Already exists in Business Edition
- ❌ **Payment Processing (Stripe, etc.)** - Already exists in Business Edition
- ❌ **Instance Provisioning Service** - Already exists in Business Edition
- ❌ **AdminJS Dashboard** - Already exists in Business Edition

#### Forbidden Features
- ❌ **Enterprise User Management** - Already exists in Business Edition
- ❌ **Advanced Permissions System** - Already exists in Business Edition
- ❌ **Advanced Analytics Dashboard** - Already exists in Business Edition
- ❌ **Business Website/Marketing Pages** - Already exists in Business Edition

**Why?** These features are proprietary to the Business Edition. Developing them in the open-source version would:
- Duplicate existing Business Edition functionality
- Create maintenance burden
- Violate the separation between open-source and proprietary editions

**What to do instead:**
- Focus on open-source compatible integrations
- Improve existing core functionality
- Add new open-source integrations (not already in Business Edition)
- Enhance documentation and developer experience

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier
- Write tests for new features
- Update documentation

## Pull Request Process

1. Create feature branch
2. Make changes
3. Run tests
4. Submit PR
5. Address review comments
6. Merge when approved

## Testing

Before submitting:

\`\`\`bash
# Run tests
npm test

# Run linting
npm run lint

# Build check
npm run build
\`\`\`
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default ContributingGuide;
