/**
 * Email Service API Type Definitions
 * 
 * Types for email sending services (Zoho SMTP, etc.)
 */

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string; // Buffer for binary, string for base64
  contentType: string;
}

/**
 * Email send options
 */
export interface EmailSendOptions {
  to: string | string[];
  from?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: EmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  headers?: Record<string, string>;
}

/**
 * Email send response
 */
export interface EmailSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email service configuration
 */
export interface EmailServiceConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  fromName?: string;
}

/**
 * Email verification options
 */
export interface EmailVerificationOptions {
  email: string;
  verificationToken: string;
  baseUrl: string;
}

/**
 * Subscription receipt email options
 */
export interface SubscriptionReceiptEmailOptions {
  email: string;
  planName: string;
  amount: number;
  currency: string;
  receiptPdfUrl: string | null;
  userName?: string;
}

/**
 * Plan change email options
 */
export interface PlanChangeEmailOptions {
  email: string;
  oldPlanName: string;
  newPlanName: string;
  userName?: string;
}

/**
 * Password reset email options
 */
export interface PasswordResetEmailOptions {
  email: string;
  resetToken: string;
  baseUrl: string;
  userName?: string;
}

/**
 * Email service error
 */
export interface EmailServiceError {
  error: string;
  code?: string;
  details?: unknown;
}
