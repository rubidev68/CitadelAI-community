import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyWebhookSignature, handleUrlVerification, SlackEvent } from '../../services/slackWebhookService';
import crypto from 'crypto';

describe('Slack Webhook Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Date.now for timestamp tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('verifyWebhookSignature', () => {
    it('should return false if signing secret is empty', () => {
      const signature = 'v0=signature';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = '{"type":"event"}';
      const signingSecret = '';

      const result = verifyWebhookSignature(signature, timestamp, body, signingSecret);

      expect(result).toBe(false);
    });

    it('should return false if timestamp is too old', () => {
      const signature = 'v0=signature';
      const oldTimestamp = Math.floor((Date.now() - 6 * 60 * 1000) / 1000).toString(); // 6 minutes ago
      const body = '{"type":"event"}';
      const signingSecret = 'test-secret';

      const result = verifyWebhookSignature(signature, oldTimestamp, body, signingSecret);

      expect(result).toBe(false);
    });

    it('should return false if timestamp is too far in future', () => {
      const signature = 'v0=signature';
      const futureTimestamp = Math.floor((Date.now() + 6 * 60 * 1000) / 1000).toString(); // 6 minutes in future
      const body = '{"type":"event"}';
      const signingSecret = 'test-secret';

      const result = verifyWebhookSignature(signature, futureTimestamp, body, signingSecret);

      expect(result).toBe(false);
    });

    it('should return true for valid signature', () => {
      const signingSecret = 'test-secret';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = '{"type":"event"}';

      // Create valid signature
      const sigBaseString = `v0:${timestamp}:${body}`;
      const hmac = crypto.createHmac('sha256', signingSecret);
      hmac.update(sigBaseString);
      const validSignature = `v0=${hmac.digest('hex')}`;

      const result = verifyWebhookSignature(validSignature, timestamp, body, signingSecret);

      expect(result).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const signingSecret = 'test-secret';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = '{"type":"event"}';
      
      // Create a signature with wrong length to trigger timingSafeEqual error handling
      // The function should catch the error and return false
      const invalidSignature = 'v0=invalid';

      // timingSafeEqual will throw if buffers have different lengths
      // The function should handle this gracefully
      const result = verifyWebhookSignature(invalidSignature, timestamp, body, signingSecret);

      expect(result).toBe(false);
    });

    it('should accept requests within 5 minute window', () => {
      const signingSecret = 'test-secret';
      const timestamp = Math.floor((Date.now() - 4 * 60 * 1000) / 1000).toString(); // 4 minutes ago
      const body = '{"type":"event"}';

      // Create valid signature
      const sigBaseString = `v0:${timestamp}:${body}`;
      const hmac = crypto.createHmac('sha256', signingSecret);
      hmac.update(sigBaseString);
      const validSignature = `v0=${hmac.digest('hex')}`;

      const result = verifyWebhookSignature(validSignature, timestamp, body, signingSecret);

      expect(result).toBe(true);
    });

    it('should handle signature with different body', () => {
      const signingSecret = 'test-secret';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body1 = '{"type":"event1"}';
      const body2 = '{"type":"event2"}';

      // Create signature for body1
      const sigBaseString = `v0:${timestamp}:${body1}`;
      const hmac = crypto.createHmac('sha256', signingSecret);
      hmac.update(sigBaseString);
      const signature = `v0=${hmac.digest('hex')}`;

      // Try to verify with body2
      const result = verifyWebhookSignature(signature, timestamp, body2, signingSecret);

      expect(result).toBe(false);
    });
  });

  describe('handleUrlVerification', () => {
    it('should return challenge for url_verification event', () => {
      const event: SlackEvent = {
        type: 'url_verification',
        challenge: 'test-challenge-123',
      };

      const result = handleUrlVerification(event);

      expect(result).toEqual({ challenge: 'test-challenge-123' });
    });

    it('should return null if challenge is missing', () => {
      const event: SlackEvent = {
        type: 'url_verification',
      };

      const result = handleUrlVerification(event);

      expect(result).toBeNull();
    });

    it('should return null for non-url_verification event', () => {
      const event: SlackEvent = {
        type: 'event_callback',
        event: {
          type: 'message',
        },
      };

      const result = handleUrlVerification(event);

      expect(result).toBeNull();
    });

    it('should return null for empty event', () => {
      const event: SlackEvent = {
        type: '',
      };

      const result = handleUrlVerification(event);

      expect(result).toBeNull();
    });
  });
});
