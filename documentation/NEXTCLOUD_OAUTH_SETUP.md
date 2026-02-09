# Nextcloud Integration Setup Guide

This guide will help you connect your Nextcloud instance to CitadelAI. There are two authentication methods available:

## Authentication Methods

### Method 1: App Password (Recommended - Simplest)

**No OAuth setup required!** Just generate an App Password in Nextcloud and use it directly.

### Method 2: OAuth 2.0

More secure token-based authentication, but requires OAuth app setup.

---

## Method 1: App Password Setup (Recommended)

### Prerequisites

- A Nextcloud instance (self-hosted or cloud)
- Your Nextcloud username

### Steps

1. **Generate App Password in Nextcloud:**
   - Log in to your Nextcloud instance
   - Go to **Settings** → **Security** → **Devices & sessions**
   - Scroll down to **"Create new app password"**
   - Enter a name (e.g., "CitadelAI")
   - Click **"Create new app password"**
   - **Copy the generated password** (format: `xxxx-xxxx-xxxx-xxxx`)
   - ⚠️ **Important**: This password is shown only once - save it securely!

2. **Configure in CitadelAI:**
   - Add a **Cloud** block to your chatbot
   - Select **Nextcloud** as provider
   - Select **"App Password"** as authentication method
   - Enter your **Nextcloud Server URL** (e.g., `https://cloud.example.com`)
   - Enter your **Nextcloud Username**
   - Paste the **App Password** you generated
   - Click **"Connect to Nextcloud"**
   - You should see a success message

**That's it!** No OAuth setup needed.

---

## Method 2: OAuth 2.0 Setup

### Prerequisites

- A Nextcloud instance (self-hosted or cloud)
- Admin access to your Nextcloud instance
- The OAuth 2.0 app must be installed and enabled in Nextcloud

### Step 1: Enable OAuth 2.0 App in Nextcloud

1. Log in to your Nextcloud instance as an administrator
2. Go to **Settings** → **Administration** → **Apps** (or click the **Apps** icon in the top menu)
3. Search for **"OAuth 2"** in the app store
4. Click **"Download and enable"** if not already installed
5. Verify the app is enabled (it should show as "Enabled" in the Apps list)

### Step 2: Create an OAuth 2.0 Client

1. In Nextcloud, go to **Settings** → **Administration** → **Security** → **OAuth 2.0**
2. Scroll down to the **"Clients"** section
3. Click **"Add client"** or **"New client"**
4. Fill in the form:
   - **Name**: `CitadelAI` (or your preferred name)
   - **Redirection URI**: 
     ```
     https://api.citadelai.app/api/admin/cloud/oauth/callback
     ```
     **Important**: Replace `https://api.citadelai.app` with your actual API URL if different
   - **Allow subdomains**: Leave unchecked (unless you need it)
5. Click **"Add"** or **"Save"**

### Step 3: Get OAuth Credentials

After creating the client, you'll see it listed in the OAuth 2.0 clients table. You'll need:

1. **Client Identifier** (Client ID) - This is displayed in the table
2. **Secret** (Client Secret) - Click the **eye icon** or **"Show"** button to reveal it

**Important**: Copy these values immediately and store them securely. The secret will only be shown once.

### Step 4: Configure in CitadelAI

1. In the CitadelAI admin dashboard, go to your chatbot
2. Add a **Cloud** block to your chatbot
3. Select **Nextcloud** as the provider
4. Select **"OAuth 2.0"** as authentication method
5. Fill in the configuration:
   - **Nextcloud Server URL**: Your Nextcloud instance URL (e.g., `https://cloud.example.com`)
   - **OAuth Client ID**: The Client Identifier from Step 3
   - **OAuth Client Secret**: The Secret from Step 3
6. Click **"Connect to Nextcloud"**
7. You'll be redirected to Nextcloud to authorize the app
8. Click **"Authorize"** or **"Allow"** in Nextcloud
9. You'll be redirected back to CitadelAI with a success message

---

## Configure Indexing (Both Methods)

After connecting:

1. **Select Paths**: Choose which folders to index (defaults to root `/`)
2. **File Type Filters**: Select which file types to index (PDF, DOCX, etc.)
3. **Auto-Refresh**: Enable automatic re-indexing at specified intervals
4. Click **"Index Now"** to start indexing files

## Troubleshooting

### "OAuth Client ID and Client Secret are required" Error

- Make sure you've entered both the Client ID and Client Secret in the Cloud block properties
- Verify the values are correct (no extra spaces)

### "Failed to exchange code for token" Error

- Verify the **Redirect URI** in Nextcloud OAuth 2.0 client matches exactly:
  ```
  https://api.citadelai.app/api/admin/cloud/oauth/callback
  ```
- Replace `https://api.citadelai.app` with your actual API URL
- Make sure there are no trailing slashes

### "Invalid redirect_uri" Error

- The redirect URI in Nextcloud must match exactly what CitadelAI uses
- Check that your API URL is correct in the Nextcloud OAuth client settings
- The redirect URI format should be: `{API_URL}/api/admin/cloud/oauth/callback`

### Connection Test Fails

- Verify your Nextcloud server URL is accessible from the CitadelAI server
- Check that OAuth 2.0 app is enabled in Nextcloud
- Verify the Client ID and Client Secret are correct
- Check Nextcloud logs for authentication errors

### Files Not Indexing

- Make sure you've clicked **"Index Now"** after connecting
- Check the indexing status in the Cloud block properties
- Verify you have read permissions for the selected folders in Nextcloud
- Check server logs for indexing errors

## Security Notes

- **Client Secret**: Treat this like a password - keep it secure and never share it
- **Access Tokens**: CitadelAI stores encrypted access tokens in the database
- **Permissions**: The OAuth app only requests read access to files
- **HTTPS**: Always use HTTPS for your Nextcloud instance in production

## API URL Configuration

If your API URL is different from `https://api.citadelai.app`, you need to:

1. Update the **Redirect URI** in your Nextcloud OAuth client to match your API URL
2. Make sure the `API_URL` environment variable is set correctly in your CitadelAI backend

Example for custom domain:
- Nextcloud Redirect URI: `https://your-api-domain.com/api/admin/cloud/oauth/callback`
- Backend `API_URL`: `https://your-api-domain.com`

## Next Steps

After successful connection and indexing:

1. Test the integration by asking questions about your cloud files in the chatbot
2. Configure auto-refresh if you want files to be re-indexed periodically
3. Monitor indexing status and file counts
4. Adjust file type filters based on your needs
