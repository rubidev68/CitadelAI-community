# Wiki Update Workflow Fixes

## Issues Fixed

### 1. Main Wiki Page (Home.md) Not Updating
- **Problem**: Home.md was being copied but not always committed/pushed
- **Fix**: Added explicit check and logging for Home.md updates
- **Fix**: Ensured Home.md is always included in commits

### 2. Multiple Workflows Running Simultaneously
- **Problem**: Multiple workflows triggered on same push, causing conflicts
- **Fix**: 
  - Restricted `update-wiki.yml` to only trigger on `main` branch
  - Restricted `business-wiki-update.yml` to only trigger on `main` branch (with 5 min delay)
  - Restricted `community-wiki-update.yml` to only trigger on `opensource-*` branches
  - Removed code file triggers (`.ts`, `.tsx`, `.js`, `.jsx`, `package.json`) to prevent conflicts

### 3. Wiki Repository Access Issues
- **Problem**: Git clone failing due to authentication/permissions
- **Fix**: 
  - Added token authentication to git clone URL
  - Added fallback to create wiki repository if it doesn't exist
  - Added support for both `master` and `main` branches
  - Improved error handling with graceful fallbacks

### 4. Permission Issues
- **Problem**: Workflows didn't have `contents: write` permission
- **Fix**: Changed permissions from `contents: read` to `contents: write`

### 5. Git Push Failures
- **Problem**: Push failing due to branch name or authentication
- **Fix**: 
  - Added fallback to try both `master` and `main` branches
  - Added `-u` flag for initial push
  - Improved error handling

## Workflow Configuration

### update-wiki.yml (Main Business Wiki)
- **Triggers**: `main` branch, documentation changes only
- **Schedule**: Daily at 2:00 AM UTC
- **Purpose**: Primary wiki update for business edition

### business-wiki-update.yml (Alternative Business Wiki)
- **Triggers**: `main` branch, documentation changes only
- **Schedule**: Daily at 2:05 AM UTC (5 min after main)
- **Purpose**: Backup/alternative wiki update

### community-wiki-update.yml (Community Wiki)
- **Triggers**: `opensource-dev`, `opensource-prod` branches only
- **Schedule**: Daily at 3:00 AM UTC
- **Purpose**: Community edition wiki updates

## Key Improvements

1. **Home.md Always Updated**: Explicit check and copy of README.md to Home.md
2. **Better Error Handling**: Workflows don't fail completely, log errors instead
3. **Token Authentication**: Proper authentication for wiki repository access
4. **Branch Flexibility**: Support for both `master` and `main` branches
5. **Conflict Prevention**: Workflows only trigger on specific branches and paths
6. **Wiki Initialization**: Auto-create wiki repository if it doesn't exist

## Testing

After these fixes:
1. Push changes to `main` branch → Only `update-wiki.yml` should trigger
2. Push changes to `opensource-dev` → Only `community-wiki-update.yml` should trigger
3. Home.md should always be updated from README.md
4. Wiki should be accessible and updatable

## Troubleshooting

If wiki updates still fail:
1. Check if wiki is enabled: Repository Settings → Features → Wikis
2. Verify `WIKI_UPDATE_TOKEN` secret has `repo` scope (if using custom token)
3. Check GitHub Actions logs for specific error messages
4. Manually initialize wiki by creating a page in GitHub UI first
