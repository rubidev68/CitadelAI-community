import { getEmailServiceClient } from './emailServiceClient';
import crypto from 'crypto';
import { config } from '../config';

/**
 * Wrapper service that maintains the same interface as the old ZohoEmailService
 * but uses the email-service microservice via HTTP
 */
class ZohoEmailService {
  private emailClient = getEmailServiceClient();

  /**
   * Send an email using the email service
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }>;
  }): Promise<void> {
    // Convert Buffer attachments to base64 strings
    const attachments = options.attachments?.map(att => ({
      filename: att.filename,
      content: att.content.toString('base64'),
      contentType: att.contentType,
    }));

    await this.emailClient.sendEmail({
      to: options.to,
      subject: options.subject,
      htmlBody: options.htmlBody,
      textBody: options.textBody,
      attachments,
    });
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, verificationToken: string, baseUrl: string): Promise<void> {
    const verificationUrl = `${baseUrl}/register?token=${verificationToken}`;
    
    const htmlBody = this.getVerificationEmailHtml(verificationUrl);
    const textBody = this.getVerificationEmailText(verificationUrl);

    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email - CitadelAI',
      htmlBody,
      textBody,
    });
  }

  /**
   * Send subscription receipt email with PDF attachment
   */
  async sendSubscriptionReceiptEmail(
    email: string,
    planName: string,
    amount: number,
    currency: string,
    receiptPdfUrl: string | null,
    userName?: string
  ): Promise<void> {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100); // Stripe amounts are in cents

    const htmlBody = this.getSubscriptionReceiptEmailHtml(planName, formattedAmount, receiptPdfUrl, userName);
    const textBody = this.getSubscriptionReceiptEmailText(planName, formattedAmount, receiptPdfUrl, userName);

    // Download PDF if URL is provided
    let attachments: Array<{ filename: string; content: Buffer; contentType: string }> | undefined;
    if (receiptPdfUrl) {
      try {
        const response = await fetch(receiptPdfUrl);
        if (response.ok) {
          const pdfBuffer = Buffer.from(await response.arrayBuffer());
          attachments = [
            {
              filename: `receipt-${new Date().toISOString().split('T')[0]}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ];
        }
      } catch (error) {
        // Log error but continue without attachment
        // Note: logger not imported here to avoid circular dependency
        // Continue without attachment if download fails
      }
    }

    await this.sendEmail({
      to: email,
      subject: `Subscription Receipt - ${planName} - CitadelAI`,
      htmlBody,
      textBody,
      attachments,
    });
  }

  /**
   * Send plan change notification email
   */
  async sendPlanChangeEmail(
    email: string,
    oldPlanName: string,
    newPlanName: string,
    userName?: string
  ): Promise<void> {
    const htmlBody = this.getPlanChangeEmailHtml(oldPlanName, newPlanName, userName);
    const textBody = this.getPlanChangeEmailText(oldPlanName, newPlanName, userName);

    await this.sendEmail({
      to: email,
      subject: `Plan Updated - ${newPlanName} - CitadelAI`,
      htmlBody,
      textBody,
    });
  }

  /**
   * Send account deletion confirmation email
   */
  async sendAccountDeletionEmail(
    email: string,
    userName?: string
  ): Promise<void> {
    const htmlBody = this.getAccountDeletionEmailHtml(email, userName);
    const textBody = this.getAccountDeletionEmailText(email, userName);

    await this.sendEmail({
      to: email,
      subject: 'Account Deleted - CitadelAI',
      htmlBody,
      textBody,
    });
  }

  /**
   * Send password change notification email
   */
  async sendPasswordChangeEmail(
    email: string,
    userName?: string
  ): Promise<void> {
    const htmlBody = this.getPasswordChangeEmailHtml(userName);
    const textBody = this.getPasswordChangeEmailText(userName);

    await this.sendEmail({
      to: email,
      subject: 'Password Changed - CitadelAI',
      htmlBody,
      textBody,
    });
  }

  /**
   * Send password reset email with reset link
   */
  async sendPasswordResetEmail(
    email: string,
    resetUrl: string,
    userName?: string
  ): Promise<void> {
    const htmlBody = this.getPasswordResetEmailHtml(resetUrl, userName);
    const textBody = this.getPasswordResetEmailText(resetUrl, userName);

    await this.sendEmail({
      to: email,
      subject: 'Reset Your Password - CitadelAI',
      htmlBody,
      textBody,
    });
  }

  /**
   * Send profile update notification email
   */
  async sendProfileUpdateEmail(
    email: string,
    changes: { name?: string; email?: string; company?: string },
    userName?: string
  ): Promise<void> {
    const htmlBody = this.getProfileUpdateEmailHtml(changes, userName);
    const textBody = this.getProfileUpdateEmailText(changes, userName);

    await this.sendEmail({
      to: email,
      subject: 'Profile Updated - CitadelAI',
      htmlBody,
      textBody,
    });
  }

  /**
   * Send trial expiring soon notification email
   */
  async sendTrialExpiringSoonEmail(
    email: string,
    planName: string,
    trialEndDate: Date,
    userName?: string
  ): Promise<void> {
    const daysRemaining = Math.ceil((trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const htmlBody = this.getTrialExpiringSoonEmailHtml(planName, trialEndDate, daysRemaining, userName);
    const textBody = this.getTrialExpiringSoonEmailText(planName, trialEndDate, daysRemaining, userName);

    await this.sendEmail({
      to: email,
      subject: `Your Trial Expires in ${daysRemaining} ${daysRemaining === 1 ? 'Day' : 'Days'} - CitadelAI`,
      htmlBody,
      textBody,
    });
  }

  /**
   * Send trial expired notification email
   */
  async sendTrialExpiredEmail(
    email: string,
    planName: string,
    trialEndDate: Date,
    userName?: string
  ): Promise<void> {
    const htmlBody = this.getTrialExpiredEmailHtml(planName, trialEndDate, userName);
    const textBody = this.getTrialExpiredEmailText(planName, trialEndDate, userName);

    await this.sendEmail({
      to: email,
      subject: 'Your Trial Has Expired - CitadelAI',
      htmlBody,
      textBody,
    });
  }

  /**
   * Send enterprise request recap email to the admin user
   */
  async sendEnterpriseRequestRecapEmail(
    email: string,
    requestDetails: {
      name?: string;
      company?: string;
      phone?: string;
      message?: string;
    },
    userName?: string
  ): Promise<void> {
    const htmlBody = this.getEnterpriseRequestRecapEmailHtml(email, requestDetails, userName);
    const textBody = this.getEnterpriseRequestRecapEmailText(email, requestDetails, userName);

    await this.sendEmail({
      to: email,
      subject: 'Enterprise Plan Request Received - CitadelAI',
      htmlBody,
      textBody,
    });
  }

  /**
   * Send enterprise request notification email to admin
   */
  async sendEnterpriseRequestNotificationEmail(
    adminEmail: string,
    requestDetails: {
      email: string;
      name?: string;
      company?: string;
      phone?: string;
      message?: string;
      adminUserName?: string;
      adminUserEmail?: string;
      requestId: string;
    }
  ): Promise<void> {
    const htmlBody = this.getEnterpriseRequestNotificationEmailHtml(requestDetails);
    const textBody = this.getEnterpriseRequestNotificationEmailText(requestDetails);

    await this.sendEmail({
      to: adminEmail,
      subject: `New Enterprise Plan Request - ${requestDetails.company || requestDetails.name || requestDetails.email}`,
      htmlBody,
      textBody,
    });
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    return await this.emailClient.verifyConnection();
  }

  /**
   * Generate a secure verification token
   */
  static generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Template methods - keeping the original implementations for reference
  // These generate the HTML/text content for each email type

  private getVerificationEmailHtml(verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #13312D; background-color: #F0EDE8; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(19, 49, 45, 0.1);">
            <div style="background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #F5F2EE; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Verify Your Email</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px; margin-top: 0;">Hello,</p>
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px;">
                Thank you for registering with CitadelAI! Please verify your email address by clicking the button below:
              </p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${verificationUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); color: #F5F2EE; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(45, 114, 109, 0.3); transition: all 0.3s ease;">
                  Verify Email Address
                </a>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 30px; margin-bottom: 10px;">
                Or copy and paste this link into your browser:
              </p>
              <div style="background: #F0EDE8; padding: 12px; border-radius: 6px; border: 1px solid #D4CCC1; margin-bottom: 20px;">
                <p style="font-size: 12px; color: #13312D; word-break: break-all; margin: 0; font-family: 'Courier New', monospace;">
                  ${verificationUrl}
                </p>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
              ${this.getSupportFooter()}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getVerificationEmailText(verificationUrl: string): string {
    return `
Verify Your Email

Hello,

Thank you for registering with CitadelAI! Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
${this.getSupportFooterText()}
    `.trim();
  }

  private getSubscriptionReceiptEmailHtml(planName: string, formattedAmount: string, receiptPdfUrl: string | null, userName?: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Subscription Receipt</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #13312D; background-color: #F0EDE8; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(19, 49, 45, 0.1);">
            <div style="background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #F5F2EE; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Subscription Confirmed</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px; margin-top: 0;">Hello${userName ? ` ${userName}` : ''},</p>
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px;">
                Thank you for subscribing to <strong>${planName}</strong>! Your subscription has been successfully activated.
              </p>
              <div style="background: #F0EDE8; padding: 20px; border-radius: 8px; border: 1px solid #D4CCC1; margin: 30px 0;">
                <h2 style="font-size: 18px; color: #13312D; margin-top: 0; margin-bottom: 15px;">Subscription Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Plan:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${planName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Amount:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${formattedAmount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                </table>
              </div>
              ${receiptPdfUrl ? `
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                Your receipt has been attached to this email. You can also view it online at any time from your account dashboard.
              </p>
              ` : `
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                You can view your receipt and manage your subscription from your account dashboard.
              </p>
              `}
              ${this.getSupportFooter()}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getSubscriptionReceiptEmailText(planName: string, formattedAmount: string, receiptPdfUrl: string | null, userName?: string): string {
    return `
Subscription Confirmed

Hello${userName ? ` ${userName}` : ''},

Thank you for subscribing to ${planName}! Your subscription has been successfully activated.

Subscription Details:
Plan: ${planName}
Amount: ${formattedAmount}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

${receiptPdfUrl ? 'Your receipt has been attached to this email.' : 'You can view your receipt and manage your subscription from your account dashboard.'}
${this.getSupportFooterText()}
    `.trim();
  }

  private getPlanChangeEmailHtml(oldPlanName: string, newPlanName: string, userName?: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Plan Changed</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #13312D; background-color: #F0EDE8; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(19, 49, 45, 0.1);">
            <div style="background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #F5F2EE; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Plan Updated</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px; margin-top: 0;">Hello${userName ? ` ${userName}` : ''},</p>
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px;">
                Your subscription plan has been successfully updated.
              </p>
              <div style="background: #F0EDE8; padding: 20px; border-radius: 8px; border: 1px solid #D4CCC1; margin: 30px 0;">
                <h2 style="font-size: 18px; color: #13312D; margin-top: 0; margin-bottom: 15px;">Plan Change Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Previous Plan:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${oldPlanName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>New Plan:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right; font-weight: 600;">${newPlanName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                Your new plan is now active. Any billing changes will be reflected in your next invoice. You can manage your subscription from your account dashboard at any time.
              </p>
              ${this.getSupportFooter()}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getPlanChangeEmailText(oldPlanName: string, newPlanName: string, userName?: string): string {
    return `
Plan Updated

Hello${userName ? ` ${userName}` : ''},

Your subscription plan has been successfully updated.

Plan Change Details:
Previous Plan: ${oldPlanName}
New Plan: ${newPlanName}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Your new plan is now active. Any billing changes will be reflected in your next invoice. You can manage your subscription from your account dashboard at any time.
${this.getSupportFooterText()}
    `.trim();
  }

  private getAccountDeletionEmailHtml(email: string, userName?: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Deleted</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #13312D; background-color: #F0EDE8; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(19, 49, 45, 0.1);">
            <div style="background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #F5F2EE; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Account Deleted</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px; margin-top: 0;">Hello${userName ? ` ${userName}` : ''},</p>
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px;">
                Your CitadelAI account has been successfully deleted.
              </p>
              <div style="background: #F0EDE8; padding: 20px; border-radius: 8px; border: 1px solid #D4CCC1; margin: 30px 0;">
                <h2 style="font-size: 18px; color: #13312D; margin-top: 0; margin-bottom: 15px;">Account Information</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Email:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Deletion Date:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                All your data, including chatbots, conversations, and subscription information, has been permanently removed from our systems. If you had an active subscription, it has been canceled and no further charges will be made.
              </p>
              <p style="font-size: 14px; color: #13312D; margin-top: 20px; line-height: 1.6;">
                If you did not request this deletion or have any questions, please contact our support team immediately.
              </p>
              ${this.getSupportFooter()}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getAccountDeletionEmailText(email: string, userName?: string): string {
    return `
Account Deleted

Hello${userName ? ` ${userName}` : ''},

Your CitadelAI account has been successfully deleted.

Account Information:
Email: ${email}
Deletion Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

All your data, including chatbots, conversations, and subscription information, has been permanently removed from our systems. If you had an active subscription, it has been canceled and no further charges will be made.

If you did not request this deletion or have any questions, please contact our support team immediately at contact@citadelai.app.
${this.getSupportFooterText()}
    `.trim();
  }

  private getPasswordChangeEmailHtml(userName?: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #13312D; background-color: #F0EDE8; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(19, 49, 45, 0.1);">
            <div style="background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #F5F2EE; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Password Changed</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px; margin-top: 0;">Hello${userName ? ` ${userName}` : ''},</p>
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px;">
                Your password has been successfully changed.
              </p>
              <div style="background: #F0EDE8; padding: 20px; border-radius: 8px; border: 1px solid #D4CCC1; margin: 30px 0;">
                <h2 style="font-size: 18px; color: #13312D; margin-top: 0; margin-bottom: 15px;">Change Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                If you did not make this change, please <a href="mailto:contact@citadelai.app" style="color: hsl(172, 45%, 32%); text-decoration: none; font-weight: 600;">contact our support team</a> immediately to secure your account.
              </p>
              ${this.getSupportFooter()}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordChangeEmailText(userName?: string): string {
    return `
Password Changed

Hello${userName ? ` ${userName}` : ''},

Your password has been successfully changed.

Change Details:
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}

If you did not make this change, please contact our support team immediately at contact@citadelai.app to secure your account.
${this.getSupportFooterText()}
    `.trim();
  }

  private getPasswordResetEmailHtml(resetUrl: string, userName?: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #13312D; background-color: #F0EDE8; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(19, 49, 45, 0.1);">
            <div style="background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #F5F2EE; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Reset Your Password</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px; margin-top: 0;">Hello${userName ? ` ${userName}` : ''},</p>
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); color: #F5F2EE; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(19, 49, 45, 0.2);">Reset Password</a>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="font-size: 12px; color: #13312D; word-break: break-all; background: #F0EDE8; padding: 12px; border-radius: 6px; margin: 10px 0;">
                ${resetUrl}
              </p>
              <div style="background: #FFF4E6; padding: 20px; border-radius: 8px; border-left: 4px solid #FFA500; margin: 30px 0;">
                <p style="font-size: 14px; color: #13312D; margin: 0; line-height: 1.6;">
                  <strong>⚠️ Important:</strong> This link will expire in 1 hour. If you did not request a password reset, please ignore this email or <a href="mailto:contact@citadelai.app" style="color: hsl(172, 45%, 32%); text-decoration: none; font-weight: 600;">contact support</a> if you have concerns.
                </p>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                <strong>Security Note:</strong> Never share this link with anyone. If you have 2FA enabled, you will need to verify with your authenticator app or backup code after resetting your password.
              </p>
              ${this.getSupportFooter()}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordResetEmailText(resetUrl: string, userName?: string): string {
    return `
Reset Your Password

Hello${userName ? ` ${userName}` : ''},

We received a request to reset your password. Use the link below to create a new password:

${resetUrl}

⚠️ Important: This link will expire in 1 hour. If you did not request a password reset, please ignore this email or contact support at contact@citadelai.app if you have concerns.

Security Note: Never share this link with anyone. If you have 2FA enabled, you will need to verify with your authenticator app or backup code after resetting your password.
${this.getSupportFooterText()}
    `.trim();
  }

  private getProfileUpdateEmailHtml(changes: { name?: string; email?: string; company?: string }, userName?: string): string {
    const changedFields: string[] = [];
    if (changes.name) changedFields.push('Name');
    if (changes.email) changedFields.push('Email');
    if (changes.company !== undefined) changedFields.push('Company');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Profile Updated</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #13312D; background-color: #F0EDE8; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(19, 49, 45, 0.1);">
            <div style="background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #F5F2EE; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Profile Updated</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px; margin-top: 0;">Hello${userName ? ` ${userName}` : ''},</p>
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px;">
                Your profile has been successfully updated.
              </p>
              <div style="background: #F0EDE8; padding: 20px; border-radius: 8px; border: 1px solid #D4CCC1; margin: 30px 0;">
                <h2 style="font-size: 18px; color: #13312D; margin-top: 0; margin-bottom: 15px;">Updated Information</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  ${changes.name ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Name:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${changes.name}</td>
                  </tr>
                  ` : ''}
                  ${changes.email ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Email:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${changes.email}</td>
                  </tr>
                  ` : ''}
                  ${changes.company !== undefined ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Company:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${changes.company || 'Not set'}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                If you did not make these changes, please <a href="mailto:contact@citadelai.app" style="color: hsl(172, 45%, 32%); text-decoration: none; font-weight: 600;">contact our support team</a> immediately to secure your account.
              </p>
              ${this.getSupportFooter()}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getProfileUpdateEmailText(changes: { name?: string; email?: string; company?: string }, userName?: string): string {
    return `
Profile Updated

Hello${userName ? ` ${userName}` : ''},

Your profile has been successfully updated.

Updated Information:
${changes.name ? `Name: ${changes.name}\n` : ''}${changes.email ? `Email: ${changes.email}\n` : ''}${changes.company !== undefined ? `Company: ${changes.company || 'Not set'}\n` : ''}Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}

If you did not make these changes, please contact our support team immediately at contact@citadelai.app to secure your account.
${this.getSupportFooterText()}
    `.trim();
  }

  private getTrialExpiringSoonEmailHtml(planName: string, trialEndDate: Date, daysRemaining: number, userName?: string): string {
    const formattedEndDate = trialEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const frontendUrl = config.FRONTEND_URL;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Trial Expiring Soon</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #13312D; background-color: #F0EDE8; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(19, 49, 45, 0.1);">
            <div style="background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #F5F2EE; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Trial Expiring Soon</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px; margin-top: 0;">Hello${userName ? ` ${userName}` : ''},</p>
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px;">
                Your <strong>${planName}</strong> trial will expire in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}.
              </p>
              <div style="background: #F0EDE8; padding: 20px; border-radius: 8px; border: 1px solid #D4CCC1; margin: 30px 0;">
                <h2 style="font-size: 18px; color: #13312D; margin-top: 0; margin-bottom: 15px;">Trial Information</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Plan:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${planName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Expires:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${formattedEndDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Days Remaining:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right; font-weight: 600;">${daysRemaining}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                To continue using CitadelAI after your trial ends, please subscribe to a plan. You can manage your subscription from your account dashboard.
              </p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${frontendUrl}/dashboard" 
                   style="display: inline-block; background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); color: #F5F2EE; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(45, 114, 109, 0.3);">
                  Subscribe Now
                </a>
              </div>
              ${this.getSupportFooter()}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getTrialExpiringSoonEmailText(planName: string, trialEndDate: Date, daysRemaining: number, userName?: string): string {
    const formattedEndDate = trialEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const frontendUrl = config.FRONTEND_URL;

    return `
Trial Expiring Soon

Hello${userName ? ` ${userName}` : ''},

Your ${planName} trial will expire in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}.

Trial Information:
Plan: ${planName}
Expires: ${formattedEndDate}
Days Remaining: ${daysRemaining}

To continue using CitadelAI after your trial ends, please subscribe to a plan. You can manage your subscription from your account dashboard at ${frontendUrl}/dashboard.
${this.getSupportFooterText()}
    `.trim();
  }

  private getTrialExpiredEmailHtml(planName: string, trialEndDate: Date, userName?: string): string {
    const formattedEndDate = trialEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const frontendUrl = config.FRONTEND_URL;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Trial Expired</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #13312D; background-color: #F0EDE8; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(19, 49, 45, 0.1);">
            <div style="background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #F5F2EE; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Trial Expired</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px; margin-top: 0;">Hello${userName ? ` ${userName}` : ''},</p>
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px;">
                Your <strong>${planName}</strong> trial has expired.
              </p>
              <div style="background: #F0EDE8; padding: 20px; border-radius: 8px; border: 1px solid #D4CCC1; margin: 30px 0;">
                <h2 style="font-size: 18px; color: #13312D; margin-top: 0; margin-bottom: 15px;">Trial Information</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Plan:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${planName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Expired:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${formattedEndDate}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                Your trial period has ended. To continue using CitadelAI and access all features, please subscribe to a plan. Your data and chatbots are safe and will be available once you subscribe.
              </p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${frontendUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); color: #F5F2EE; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(45, 114, 109, 0.3);">
                  Subscribe Now
                </a>
              </div>
              ${this.getSupportFooter()}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getTrialExpiredEmailText(planName: string, trialEndDate: Date, userName?: string): string {
    const formattedEndDate = trialEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const frontendUrl = config.FRONTEND_URL;

    return `
Trial Expired

Hello${userName ? ` ${userName}` : ''},

Your ${planName} trial has expired.

Trial Information:
Plan: ${planName}
Expired: ${formattedEndDate}

Your trial period has ended. To continue using CitadelAI and access all features, please subscribe to a plan. Your data and chatbots are safe and will be available once you subscribe.

Visit ${frontendUrl}/dashboard to subscribe.
${this.getSupportFooterText()}
    `.trim();
  }

  private getEnterpriseRequestRecapEmailHtml(email: string, requestDetails: { name?: string; company?: string; phone?: string; message?: string }, userName?: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Enterprise Plan Request Received</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #13312D; background-color: #F0EDE8; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(19, 49, 45, 0.1);">
            <div style="background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #F5F2EE; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Request Received</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px; margin-top: 0;">Hello${userName ? ` ${userName}` : ''},</p>
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px;">
                Thank you for your interest in our Enterprise plan! We've received your request and a member of our team will contact you within 24 hours.
              </p>
              <div style="background: #F0EDE8; padding: 20px; border-radius: 8px; border: 1px solid #D4CCC1; margin: 30px 0;">
                <h2 style="font-size: 18px; color: #13312D; margin-top: 0; margin-bottom: 15px;">Your Request Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Email:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${email}</td>
                  </tr>
                  ${requestDetails.name ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Name:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.name}</td>
                  </tr>
                  ` : ''}
                  ${requestDetails.company ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Company:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.company}</td>
                  </tr>
                  ` : ''}
                  ${requestDetails.phone ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Phone:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.phone}</td>
                  </tr>
                  ` : ''}
                  ${requestDetails.message ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; vertical-align: top;"><strong>Message:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.message.replace(/\n/g, '<br>')}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Submitted:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                Our team will review your request and get back to you within 24 hours to discuss your Enterprise plan needs and answer any questions you may have.
              </p>
              ${this.getSupportFooter()}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getEnterpriseRequestRecapEmailText(email: string, requestDetails: { name?: string; company?: string; phone?: string; message?: string }, userName?: string): string {
    return `
Enterprise Plan Request Received

Hello${userName ? ` ${userName}` : ''},

Thank you for your interest in our Enterprise plan! We've received your request and a member of our team will contact you within 24 hours.

Your Request Details:
Email: ${email}
${requestDetails.name ? `Name: ${requestDetails.name}\n` : ''}${requestDetails.company ? `Company: ${requestDetails.company}\n` : ''}${requestDetails.phone ? `Phone: ${requestDetails.phone}\n` : ''}${requestDetails.message ? `Message: ${requestDetails.message}\n` : ''}Submitted: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}

Our team will review your request and get back to you within 24 hours to discuss your Enterprise plan needs and answer any questions you may have.
${this.getSupportFooterText()}
    `.trim();
  }

  private getEnterpriseRequestNotificationEmailHtml(requestDetails: { email: string; name?: string; company?: string; phone?: string; message?: string; adminUserName?: string; adminUserEmail?: string; requestId: string }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Enterprise Plan Request</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #13312D; background-color: #F0EDE8; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(19, 49, 45, 0.1);">
            <div style="background: linear-gradient(135deg, hsl(172, 45%, 32%) 0%, hsl(172, 50%, 40%) 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #F5F2EE; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">New Enterprise Request</h1>
            </div>
            <div style="background: #FFFFFF; padding: 40px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px; margin-top: 0;">Hello,</p>
              <p style="font-size: 16px; color: #13312D; margin-bottom: 20px;">
                A new Enterprise plan request has been submitted through the admin dashboard.
              </p>
              <div style="background: #F0EDE8; padding: 20px; border-radius: 8px; border: 1px solid #D4CCC1; margin: 30px 0;">
                <h2 style="font-size: 18px; color: #13312D; margin-top: 0; margin-bottom: 15px;">Request Information</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Request ID:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.requestId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Contact Email:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.email}</td>
                  </tr>
                  ${requestDetails.name ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Name:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.name}</td>
                  </tr>
                  ` : ''}
                  ${requestDetails.company ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Company:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.company}</td>
                  </tr>
                  ` : ''}
                  ${requestDetails.phone ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Phone:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.phone}</td>
                  </tr>
                  ` : ''}
                  ${requestDetails.message ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; vertical-align: top;"><strong>Message:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.message.replace(/\n/g, '<br>')}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              <div style="background: #F0EDE8; padding: 20px; border-radius: 8px; border: 1px solid #D4CCC1; margin: 30px 0;">
                <h2 style="font-size: 18px; color: #13312D; margin-top: 0; margin-bottom: 15px;">Submitted By</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  ${requestDetails.adminUserName ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Name:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.adminUserName}</td>
                  </tr>
                  ` : ''}
                  ${requestDetails.adminUserEmail ? `
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Email:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${requestDetails.adminUserEmail}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px;"><strong>Submitted:</strong></td>
                    <td style="padding: 8px 0; color: #13312D; font-size: 14px; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #13312D; margin-top: 25px; line-height: 1.6;">
                Please review this request and contact the customer within 24 hours as promised.
              </p>
              ${this.getSupportFooter()}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getEnterpriseRequestNotificationEmailText(requestDetails: { email: string; name?: string; company?: string; phone?: string; message?: string; adminUserName?: string; adminUserEmail?: string; requestId: string }): string {
    return `
New Enterprise Plan Request

Hello,

A new Enterprise plan request has been submitted through the admin dashboard.

Request Information:
Request ID: ${requestDetails.requestId}
Contact Email: ${requestDetails.email}
${requestDetails.name ? `Name: ${requestDetails.name}\n` : ''}${requestDetails.company ? `Company: ${requestDetails.company}\n` : ''}${requestDetails.phone ? `Phone: ${requestDetails.phone}\n` : ''}${requestDetails.message ? `Message: ${requestDetails.message}\n` : ''}
Submitted By:
${requestDetails.adminUserName ? `Name: ${requestDetails.adminUserName}\n` : ''}${requestDetails.adminUserEmail ? `Email: ${requestDetails.adminUserEmail}\n` : ''}Submitted: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}

Please review this request and contact the customer within 24 hours as promised.
${this.getSupportFooterText()}
    `.trim();
  }

  private getSupportFooter(): string {
    return `
      <!-- Divider -->
      <hr style="border: none; border-top: 1px solid #D4CCC1; margin: 35px 0;">
      
      <!-- Support Link -->
      <p style="font-size: 14px; color: #13312D; text-align: center; margin: 20px 0;">
        Need help? <a href="mailto:contact@citadelai.app" style="color: hsl(172, 45%, 32%); text-decoration: none; font-weight: 600;">Contact Support</a>
      </p>
      
      <!-- Footer -->
      <p style="font-size: 12px; color: #13312D; text-align: center; margin: 0; opacity: 0.7;">
        © ${new Date().getFullYear()} CitadelAI. All rights reserved.
      </p>
    `;
  }

  private getSupportFooterText(): string {
    return `\n\nNeed help? Contact Support at contact@citadelai.app\n\n© ${new Date().getFullYear()} CitadelAI. All rights reserved.`;
  }
}

// Export singleton instance
let emailServiceInstance: ZohoEmailService | null = null;

export function getEmailService(): ZohoEmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new ZohoEmailService();
  }
  return emailServiceInstance;
}

export { ZohoEmailService };
