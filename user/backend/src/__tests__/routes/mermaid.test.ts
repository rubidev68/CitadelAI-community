import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import mermaidRouter from '../../routes/mermaid';

// Mock mermaid image service - use vi.hoisted to avoid hoisting issues
const { mockMermaidImageService } = vi.hoisted(() => {
  const mockMermaidImageService = {
    mermaidToImage: vi.fn(),
  };
  return { mockMermaidImageService };
});

vi.mock('../../services/mermaidImageService', () => ({
  mermaidToImage: mockMermaidImageService.mermaidToImage,
}));

describe('Mermaid Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/mermaid', mermaidRouter);
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/mermaid/to-image', () => {
    it('should return 401 if internal service token is missing', async () => {
      const response = await request(app)
        .post('/api/mermaid/to-image')
        .send({ mermaidCode: 'graph TD; A-->B;' })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 401 if internal service token is invalid', async () => {
      const response = await request(app)
        .post('/api/mermaid/to-image')
        .set('x-internal-service', 'admin-backend')
        .set('x-internal-service-token', 'wrong-token')
        .send({ mermaidCode: 'graph TD; A-->B;' })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 401 if caller service is not admin-backend', async () => {
      const response = await request(app)
        .post('/api/mermaid/to-image')
        .set('x-internal-service', 'other-service')
        .set('x-internal-service-token', 'test-internal-token')
        .send({ mermaidCode: 'graph TD; A-->B;' })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 400 if mermaidCode is missing', async () => {
      const response = await request(app)
        .post('/api/mermaid/to-image')
        .set('x-internal-service', 'admin-backend')
        .set('x-internal-service-token', 'test-internal-token')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('mermaidCode is required');
    });

    it('should return 400 if mermaidCode is not a string', async () => {
      const response = await request(app)
        .post('/api/mermaid/to-image')
        .set('x-internal-service', 'admin-backend')
        .set('x-internal-service-token', 'test-internal-token')
        .send({ mermaidCode: 123 })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      // Check for error message about mermaidCode - may be "is required" or "Expected string"
      const errorMessage = response.body.message || response.body.error || '';
      expect(errorMessage).toMatch(/mermaidCode.*required|mermaidCode.*Expected string|Expected string.*mermaidCode/i);
    });

    it('should convert mermaid code to image successfully', async () => {
      const mockImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      mockMermaidImageService.mermaidToImage.mockResolvedValue(mockImageBase64);

      const response = await request(app)
        .post('/api/mermaid/to-image')
        .set('x-internal-service', 'admin-backend')
        .set('x-internal-service-token', 'test-internal-token')
        .send({ mermaidCode: 'graph TD; A-->B;' })
        .expect(200);

      expect(response.body.imageBase64).toBe(mockImageBase64);
      expect(mockMermaidImageService.mermaidToImage).toHaveBeenCalledWith('graph TD; A-->B;');
    });

    it('should handle complex mermaid diagrams', async () => {
      const complexDiagram = `
        graph LR
          A[Start] --> B{Decision}
          B -->|Yes| C[Action 1]
          B -->|No| D[Action 2]
          C --> E[End]
          D --> E
      `;
      const mockImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      mockMermaidImageService.mermaidToImage.mockResolvedValue(mockImageBase64);

      const response = await request(app)
        .post('/api/mermaid/to-image')
        .set('x-internal-service', 'admin-backend')
        .set('x-internal-service-token', 'test-internal-token')
        .send({ mermaidCode: complexDiagram })
        .expect(200);

      expect(response.body.imageBase64).toBe(mockImageBase64);
      expect(mockMermaidImageService.mermaidToImage).toHaveBeenCalledWith(complexDiagram);
    });

    it('should handle errors gracefully', async () => {
      mockMermaidImageService.mermaidToImage.mockRejectedValue(
        new Error('Invalid mermaid syntax')
      );

      const response = await request(app)
        .post('/api/mermaid/to-image')
        .set('x-internal-service', 'admin-backend')
        .set('x-internal-service-token', 'test-internal-token')
        .send({ mermaidCode: 'invalid mermaid code' })
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBe('Invalid mermaid syntax');
    });

    it('should handle missing INTERNAL_SERVICE_TOKEN environment variable', async () => {
      const originalToken = process.env.INTERNAL_SERVICE_TOKEN;
      delete process.env.INTERNAL_SERVICE_TOKEN;

      const response = await request(app)
        .post('/api/mermaid/to-image')
        .set('x-internal-service', 'admin-backend')
        .set('x-internal-service-token', '')
        .send({ mermaidCode: 'graph TD; A-->B;' });

      // Restore token for other tests
      if (originalToken) {
        process.env.INTERNAL_SERVICE_TOKEN = originalToken;
      }

      // When token is missing, middleware should return 401 or 500 depending on implementation
      expect([401, 500]).toContain(response.status);
      expect(response.body.error).toBeDefined();
    });
  });
});
