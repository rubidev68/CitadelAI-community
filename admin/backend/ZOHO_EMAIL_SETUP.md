# Zoho Email SMTP Setup Guide

This guide explains how to configure Zoho Mail SMTP for sending verification emails in the CitadelAI admin registration flow.

## Prerequisites

1. A Zoho account with Mail service enabled
2. A verified email address in Zoho Mail (for sending emails)
3. SMTP access enabled for your Zoho account

## Getting SMTP Credentials

### Step 1: Enable SMTP Access

1. Log into your [Zoho Mail account](https://mail.zoho.com/)
2. Go to **Settings** > **Mail Accounts**
3. Select your email account
4. Navigate to **POP/IMAP Access** or **SMTP Settings**
5. Enable **SMTP Access**

### Step 2: Generate App-Specific Password (Recommended)

For better security, use an app-specific password instead of your regular password:

1. Go to [Zoho Account Security](https://accounts.zoho.com/home#security/app-passwords)
2. Click on **App Passwords**
3. Generate a new app password for "Mail"
4. Copy the generated password (you won't be able to see it again)

**Note:** If you have 2FA enabled, you must use an app-specific password.

### Step 3: Note Your SMTP Settings

Zoho Mail SMTP settings:
- **Host:** `smtp.zoho.com`
- **Port:** `587` (TLS) or `465` (SSL)
- **Security:** TLS (for port 587) or SSL (for port 465)
- **Authentication:** Required (your email and password/app password)

## Environment Variables

Add these to your `.env` file or environment configuration:

```bash
# Required
ZOHO_EMAIL_USER=your-email@yourdomain.com
ZOHO_EMAIL_PASSWORD=your_password_or_app_password
ZOHO_EMAIL_FROM=your-email@yourdomain.com

# Optional
ZOHO_EMAIL_FROM_NAME=CitadelAI
ZOHO_EMAIL_HOST=smtp.zoho.com
ZOHO_EMAIL_PORT=587
ZOHO_EMAIL_SECURE=false
FRONTEND_URL=https://your-frontend-domain.com
```

### Environment Variable Details

- **ZOHO_EMAIL_USER**: Your Zoho email address (used for authentication)
- **ZOHO_EMAIL_PASSWORD**: Your Zoho password or app-specific password
- **ZOHO_EMAIL_FROM**: The email address to send from (usually same as ZOHO_EMAIL_USER)
- **ZOHO_EMAIL_FROM_NAME**: Display name for the sender (defaults to "CitadelAI")
- **ZOHO_EMAIL_HOST**: SMTP host (defaults to "smtp.zoho.com")
- **ZOHO_EMAIL_PORT**: SMTP port (defaults to 587 for TLS)
- **ZOHO_EMAIL_SECURE**: Set to "true" for SSL (port 465), "false" for TLS (port 587)
- **FRONTEND_URL**: Your frontend URL for verification links

## Port Configuration

### Port 587 (TLS - Recommended)
```bash
ZOHO_EMAIL_PORT=587
ZOHO_EMAIL_SECURE=false
```
- Uses STARTTLS
- More compatible with firewalls
- Recommended for most setups

### Port 465 (SSL)
```bash
ZOHO_EMAIL_PORT=465
ZOHO_EMAIL_SECURE=true
```
- Uses SSL/TLS from the start
- May be blocked by some firewalls
- Use if port 587 doesn't work

## Testing the Configuration

You can test your SMTP configuration by calling the `verifyConnection()` method:

```typescript
import { getEmailService } from './services/zoho-email';

const emailService = getEmailService();
await emailService.verifyConnection();
```

This will verify that:
- The SMTP server is reachable
- Your credentials are correct
- The connection can be established

## Troubleshooting

### Common Issues:

1. **"Authentication failed" error:**
   - Verify your email and password are correct
   - If you have 2FA enabled, use an app-specific password
   - Check that SMTP access is enabled in your Zoho account settings
   - Ensure you're using the correct email address (not an alias)

2. **"Connection failed" error:**
   - Check that your firewall allows outbound connections on port 587 or 465
   - Verify the SMTP host is correct: `smtp.zoho.com`
   - Try switching between port 587 (TLS) and 465 (SSL)
   - Check if your network blocks SMTP connections

3. **"535 Authentication failed" error:**
   - This usually means you need to use an app-specific password
   - Generate one from [Zoho Account Security](https://accounts.zoho.com/home#security/app-passwords)
   - Replace your regular password with the app-specific password

4. **Emails not received:**
   - Check spam/junk folders
   - Verify the recipient email address is correct
   - Check Zoho account for delivery status
   - Review server logs for detailed error messages
   - Ensure your Zoho account isn't suspended or restricted

5. **"Connection timeout" error:**
   - Check your network connection
   - Verify firewall settings allow SMTP connections
   - Try using a different port (587 vs 465)
   - Check if your hosting provider blocks SMTP ports

### Security Best Practices

- ✅ Use app-specific passwords instead of your main account password
- ✅ Never commit credentials to version control
- ✅ Use environment variables for all sensitive configuration
- ✅ Rotate passwords regularly
- ✅ Monitor email sending for suspicious activity
- ✅ Use TLS (port 587) for better security

### Getting Help

- [Zoho Mail SMTP Settings](https://www.zoho.com/mail/help/zoho-mail-smtp-configuration.html)
- [Zoho Mail Support](https://help.zoho.com/portal/en/kb/mail)
- Check server logs for detailed error messages
- Verify SMTP settings in your Zoho account

## Example Configuration

Here's a complete example `.env` configuration:

```bash
# Zoho Email SMTP Configuration
ZOHO_EMAIL_USER=noreply@yourdomain.com
ZOHO_EMAIL_PASSWORD=your_app_specific_password_here
ZOHO_EMAIL_FROM=noreply@yourdomain.com
ZOHO_EMAIL_FROM_NAME=CitadelAI
ZOHO_EMAIL_HOST=smtp.zoho.com
ZOHO_EMAIL_PORT=587
ZOHO_EMAIL_SECURE=false

# Frontend URL for verification links
FRONTEND_URL=https://app.yourdomain.com
```

## Migration from API to SMTP

If you were previously using the Zoho API, you'll need to:

1. Remove the old API-related environment variables:
   - `ZOHO_EMAIL_API_KEY`
   - `ZOHO_EMAIL_API_URL`

2. Add the new SMTP-related environment variables:
   - `ZOHO_EMAIL_USER`
   - `ZOHO_EMAIL_PASSWORD`
   - `ZOHO_EMAIL_FROM`

3. Restart your application to load the new configuration

The email service will automatically use SMTP instead of the API.
