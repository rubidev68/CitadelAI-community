import axios from 'axios';
import { createResilientClient, ResilientHttpClient } from '@shared/resilience';
import { logger } from '@shared/utils';
import { config } from '../config';

const emailServiceClientLogger = logger.child({ service: 'admin-backend', component: 'emailServiceClient' });

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
    contentType: string;
  }>;
}

export interface EmailServiceResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Client for communicating with the email service
 * Uses resilient HTTP client with retry logic and circuit breaker
 */
class EmailServiceClient {
  private client: ResilientHttpClient;
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.EMAIL_SERVICE_URL;
    
    // Create resilient client with retry and circuit breaker
    this.client = createResilientClient({
      baseURL: this.baseUrl,
      serviceName: 'email-service',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      retry: {
        attempts: 5,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 16000,
        jitter: true,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        successThreshold: 2,
      },
      healthCheck: {
        enabled: true,
        endpoint: '/api/email/verify',
        interval: 30000, // 30 seconds
        timeout: 5000,
      },
    });
  }

  /**
   * Send an email via the email service
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    try {
      // Convert attachments if provided
      const attachments = options.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      }));

      const response = await this.client.post<EmailServiceResponse>('/api/email/send', {
        to: options.to,
        subject: options.subject,
        htmlBody: options.htmlBody,
        textBody: options.textBody,
        attachments,
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to send email');
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`Email service error: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Verify email service connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      const response = await this.client.get<{ success: boolean; message: string }>('/api/email/verify');
      return response.data.success;
    } catch (error) {
      emailServiceClientLogger.error('Email service connection verification failed', { error: error instanceof Error ? error : new Error(String(error)) });
      return false;
    }
  }
}

// Export singleton instance
let emailServiceClientInstance: EmailServiceClient | null = null;

export function getEmailServiceClient(): EmailServiceClient {
  if (!emailServiceClientInstance) {
    emailServiceClientInstance = new EmailServiceClient();
  }
  return emailServiceClientInstance;
}

export { EmailServiceClient };
