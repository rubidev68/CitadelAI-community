# Cloud Block Usage Guide

## Overview

The Cloud Block enables your chatbots to access and search files stored in cloud storage services like Nextcloud. This allows your chatbot to answer questions based on documents stored in your cloud storage without copying everything into the system.

## Features

- **Multiple Cloud Providers**: Support for Nextcloud, Google Drive, and OneDrive
- **Hybrid Indexing**: Only metadata and summaries are stored in the system, full content is fetched on-demand
- **Two Authentication Methods**:
  - **App Password** (Recommended): Simple authentication without OAuth setup
  - **OAuth 2.0**: More secure token-based authentication
- **Automatic Indexing**: Files are automatically indexed and kept up-to-date
- **Smart Search**: Semantic search finds relevant files based on user queries
- **File Type Support**: PDF, Markdown, and text files (with more formats coming soon)
- **Selective Indexing**: Choose which folders to index
- **Auto-Refresh**: Automatically re-index files on a schedule

---

## Getting Started

### Step 1: Add Cloud Block to Your Chatbot

1. Open your chatbot in the builder
2. Drag the **Cloud** block from the Context category onto the canvas
3. Connect it to your System Prompt block (or other logic blocks)
4. Click on the Cloud block to configure it

### Step 2: Select Cloud Provider

In the Cloud block properties panel:

1. Select your cloud provider:
   - **Nextcloud**: Self-hosted cloud storage
   - **Google Drive**: Google's cloud storage
   - **OneDrive**: Microsoft's cloud storage
2. For **Nextcloud**, enter your **Nextcloud Server URL** (e.g., `https://cloud.example.com`)
3. For **Google Drive** and **OneDrive**, OAuth credentials are configured globally by administrators

### Step 3: Choose Authentication Method

#### Option A: App Password (Recommended - No OAuth Setup Required)

1. Select **"App Password"** as the authentication method
2. **Generate App Password in Nextcloud**:
   - Log in to your Nextcloud instance
   - Go to **Settings** → **Security** → **Devices & sessions**
   - Scroll down to **"Create new app password"**
   - Enter a name (e.g., "CitadelAI")
   - Click **"Create new app password"**
   - **Copy the generated password** (format: `xxxx-xxxx-xxxx-xxxx`)
   - ⚠️ **Important**: This password is shown only once - save it securely!
3. **Enter Credentials in CitadelAI**:
   - Enter your **Nextcloud Username**
   - Paste the **App Password** you generated
4. Click **"Connect to Nextcloud"**
5. You should see a success message

**That's it!** No OAuth setup needed.

#### Option B: OAuth 2.0 (Requires OAuth App Setup)

**For Nextcloud:**
1. Select **"OAuth 2.0"** as the authentication method
2. **Set up OAuth App in Nextcloud** (see [Nextcloud OAuth Setup Guide](./NEXTCLOUD_OAUTH_SETUP.md)):
   - Enable OAuth 2.0 app in Nextcloud
   - Create an OAuth client
   - Get Client ID and Client Secret
3. **Enter OAuth Credentials**:
   - Enter your **OAuth Client ID**
   - Enter your **OAuth Client Secret**
4. Click **"Connect to Nextcloud"**
5. A popup window will open asking you to authorize the app
6. Click **"Authorize"** in Nextcloud
7. The popup will close automatically and you'll see a success message

**For Google Drive:**
1. Click **"Connect to Google Drive"**
2. A popup window will open asking you to authorize the app
3. Sign in with your Google account
4. Click **"Allow"** to grant access
5. The popup will close automatically and you'll see a success message
6. **Note**: OAuth credentials are configured globally by administrators (see [Google Drive OAuth Setup Guide](./GOOGLE_DRIVE_OAUTH_SETUP.md))

**For OneDrive:**
1. Click **"Connect to OneDrive"**
2. A popup window will open asking you to authorize the app
3. Sign in with your Microsoft account
4. Click **"Accept"** to grant access
5. The popup will close automatically and you'll see a success message
6. **Note**: OAuth credentials are configured globally by administrators (see [OneDrive OAuth Setup Guide](./ONEDRIVE_OAUTH_SETUP.md))

### Step 4: Configure Indexing

After connecting, configure what files to index:

1. **Select Paths**: Choose which folders to index (default: root folder)
   - Click **"Add Path"** to add more folders
   - Enter folder paths relative to your Nextcloud root (e.g., `/Documents`, `/Projects`)
2. **File Type Filters** (Optional): Filter by file extension
   - By default, all supported file types are indexed
   - Supported types: PDF, Markdown (.md), Text files (.txt)
3. **Auto-Refresh** (Optional): Enable automatic re-indexing
   - Toggle **"Enable Auto-Refresh"**
   - Set **Refresh Interval** (hours)
   - Files will be automatically re-indexed on schedule

### Step 5: Index Files

1. Click **"Index Now"** to start indexing files
2. Watch the progress:
   - **Status**: Shows indexing progress
   - **Indexed Files**: Number of files indexed
   - **Last Indexed**: Timestamp of last successful indexing
3. Wait for indexing to complete (this may take a few minutes for large folders)

---

## How It Works

### Hybrid Indexing Approach

The Cloud Block uses a hybrid approach to avoid copying all files into the system:

1. **Metadata Storage**: Only essential metadata is stored in Weaviate:
   - File paths and names
   - File types and sizes
   - Modification dates
   - LLM-generated summaries (for text content)

2. **On-Demand Content Retrieval**: When a user asks a question:
   - The system searches metadata/summaries in Weaviate
   - Identifies relevant files
   - Fetches actual file content from your cloud storage (only for relevant files)
   - Uses the content to generate an answer

3. **Caching**: Fetched file content is cached in memory for 1 hour to improve performance

### File Processing

- **PDF Files**: Text is extracted from PDFs
- **Markdown Files**: Processed as-is
- **Text Files**: Processed directly
- **File Size Limit**: Files larger than 10MB are skipped

---

## Configuration Options

### Connection Settings

- **Provider**: Cloud storage provider (Nextcloud, Google Drive, OneDrive)
  - **Nextcloud**: Requires server URL and OAuth credentials (per-block configuration)
  - **Google Drive**: Uses global OAuth credentials (configured by admin)
  - **OneDrive**: Uses global OAuth credentials (configured by admin)
- **Server URL**: Your cloud storage server URL
- **Authentication Method**: App Password or OAuth 2.0
- **Connection Status**: Shows if connected and when

### Indexing Settings

- **Selected Paths**: Folders to index (empty = root folder)
- **File Type Filters**: Filter by file extension (optional)
- **Auto-Refresh**: Enable automatic re-indexing
- **Refresh Interval**: Hours between auto-refresh (default: 24 hours)

### Indexing Status

- **Status**: Current indexing state (idle, indexing, completed, error)
- **Indexed Files**: Number of files successfully indexed
- **Last Indexed**: Timestamp of last successful indexing
- **Indexing Error**: Error message if indexing failed

---

## Usage in Chat

Once configured and indexed, your chatbot will automatically:

1. **Search Cloud Files**: When users ask questions, the system searches your indexed cloud files
2. **Retrieve Relevant Content**: Fetches content from relevant files
3. **Generate Answers**: Uses the content to provide accurate answers
4. **Cite Sources**: Shows which files were used to answer the question

### Example Queries

- "What's in the project proposal document?"
- "Summarize the meeting notes from last week"
- "What are the key points in the technical documentation?"

---

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to Nextcloud

**Solutions**:
1. **Check Server URL**: Ensure the URL is correct and accessible
2. **Verify Credentials**: Double-check username and app password (or OAuth credentials)
3. **Check Network**: Ensure your server can reach the Nextcloud instance
4. **SSL Certificate**: If using self-signed certificates, the system automatically skips SSL verification
5. **Firewall**: Ensure ports 80/443 are accessible

**Problem**: OAuth popup doesn't open

**Solutions**:
1. **Allow Popups**: Check browser popup blocker settings
2. **Try Different Browser**: Some browsers block popups more aggressively
3. **Check Console**: Look for errors in browser console

**Problem**: OAuth callback timeout

**Solutions**:
1. **Check Network**: Ensure backend can reach Nextcloud server
2. **Increase Timeout**: The timeout is set to 60 seconds - if your Nextcloud is slow, this may not be enough
3. **Check Nextcloud Logs**: Look for errors in Nextcloud logs
4. **Verify OAuth App**: Ensure OAuth app is properly configured

### Indexing Issues

**Problem**: No files are being indexed

**Solutions**:
1. **Check Selected Paths**: Ensure paths are correct and accessible
2. **Check File Types**: Ensure files match supported types (PDF, Markdown, Text)
3. **Check File Size**: Files larger than 10MB are skipped
4. **Check Permissions**: Ensure the connected account has read access to the folders
5. **Check Logs**: Look for error messages in the indexing status

**Problem**: Indexing is slow

**Solutions**:
1. **Reduce Scope**: Index fewer folders or use file type filters
2. **Check Network**: Slow connection to Nextcloud will slow indexing
3. **Check File Count**: Large numbers of files take time to process

**Problem**: Some files are not indexed

**Solutions**:
1. **File Type**: Only PDF, Markdown, and text files are supported
2. **File Size**: Files larger than 10MB are skipped
3. **Permissions**: Ensure account has read access
4. **File Format**: Some PDFs may not have extractable text

### Search Issues

**Problem**: Chatbot doesn't find relevant files

**Solutions**:
1. **Re-index**: Try re-indexing files to update summaries
2. **Check Indexing Status**: Ensure indexing completed successfully
3. **Improve Queries**: More specific queries work better
4. **Check File Content**: Ensure files contain relevant content

---

## Security Considerations

### App Password Security

- **One-Time Display**: App passwords are shown only once - save them securely
- **Revocable**: You can revoke app passwords in Nextcloud settings
- **Scoped Access**: App passwords only have access to files the account can access
- **Not Encrypted**: App passwords are stored in block properties (not encrypted) - use OAuth for higher security

### OAuth Security

- **Token Encryption**: OAuth tokens are encrypted before storage
- **Automatic Refresh**: Access tokens are automatically refreshed when expired
- **Scoped Access**: OAuth tokens only have read access to files
- **Revocable**: You can revoke access in Nextcloud OAuth settings

### General Security

- **HTTPS**: Always use HTTPS for Nextcloud connections
- **Access Control**: Only index folders that contain non-sensitive information
- **Regular Review**: Periodically review indexed files and remove unnecessary ones
- **Disconnect**: Disconnect cloud storage if no longer needed

---

## Best Practices

1. **Use App Password for Testing**: App Password is simpler for initial setup and testing
2. **Use OAuth for Production**: OAuth provides better security for production environments
3. **Selective Indexing**: Only index folders that contain relevant information
4. **Regular Re-indexing**: Enable auto-refresh to keep content up-to-date
5. **Monitor Indexing**: Check indexing status regularly to ensure it's working
6. **File Organization**: Organize files in Nextcloud for easier indexing
7. **Naming Conventions**: Use descriptive file names for better search results
8. **File Size**: Keep files under 10MB for indexing
9. **Backup**: Keep backups of important files outside of cloud storage
10. **Documentation**: Document which folders are indexed for your team

---

## Limitations

### Current Limitations

- **File Size**: Files larger than 10MB are skipped
- **File Types**: Only PDF, Markdown, and text files are supported
- **Providers**: Nextcloud, Google Drive, and OneDrive are all supported
- **Indexing Speed**: Large numbers of files may take time to index
- **Content Caching**: File content is cached for 1 hour (may show stale content)

### Coming Soon

- Support for more file types (DOCX, PPTX, XLSX)
- Improved indexing performance
- Better error handling and retry logic
- File change detection (only re-index changed files)

---

## API Reference

### Cloud Integration Endpoints

The Cloud Block uses the following API endpoints (internal):

- `GET /api/admin/cloud/oauth/start`: Start OAuth flow
- `GET /api/admin/cloud/oauth/callback`: OAuth callback handler
- `GET /api/admin/cloud/integration/:blockId`: Get integration status
- `PUT /api/admin/cloud/integration/:blockId`: Update integration configuration
- `POST /api/admin/cloud/integration/:blockId/test`: Test connection
- `DELETE /api/admin/cloud/integration/:blockId`: Disconnect integration
- `POST /api/admin/cloud/integration/:blockId/index`: Trigger file indexing

---

## Support

For additional help:

- **Setup Guides**: 
  - [Nextcloud OAuth Setup Guide](./NEXTCLOUD_OAUTH_SETUP.md) for Nextcloud OAuth configuration
  - [Google Drive OAuth Setup Guide](./GOOGLE_DRIVE_OAUTH_SETUP.md) for Google Drive OAuth configuration
  - [OneDrive OAuth Setup Guide](./ONEDRIVE_OAUTH_SETUP.md) for OneDrive OAuth configuration
- **Troubleshooting**: Check the Troubleshooting section above
- **Error Messages**: Review error messages in the Cloud block properties panel
- **Logs**: Check backend logs for detailed error information
- **Contact Support**: Contact support with your chatbot ID and block ID

---

## Changelog

### Version 1.0 (Initial Release)
- Nextcloud integration
- App Password authentication
- OAuth 2.0 authentication
- Hybrid indexing (metadata + on-demand content)
- PDF, Markdown, and text file support
- Automatic indexing
- Auto-refresh scheduling
- Selective folder indexing
- File type filtering
- In-memory content caching (1 hour)
