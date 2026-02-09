import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mermaidToImage, extractAndConvertMermaidDiagrams, removeMermaidBlocks } from '../../services/mermaidImageService';
import { getServiceBaseUrl } from '@shared/utils';

// Mock dependencies
vi.mock('@shared/utils', () => ({
  getServiceBaseUrl: vi.fn(),
  logger: {
    child: vi.fn(() => ({
      error: vi.fn(),
    })),
  },
}));

// Mock global fetch
global.fetch = vi.fn();

describe('Mermaid Image Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServiceBaseUrl).mockReturnValue('http://user-backend:3000');
    process.env.INTERNAL_SERVICE_TOKEN = 'test-token';
  });

  describe('mermaidToImage', () => {
    it('should convert mermaid code to base64 image', async () => {
      const mermaidCode = 'graph TD\nA[Start] --> B[End]';
      const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAA...';
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ imageBase64 }),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      const result = await mermaidToImage(mermaidCode);

      expect(getServiceBaseUrl).toHaveBeenCalledWith('user-backend');
      expect(global.fetch).toHaveBeenCalledWith('http://user-backend:3000/api/mermaid/to-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service': 'admin-backend',
          'X-Internal-Service-Token': 'test-token',
        },
        body: JSON.stringify({ mermaidCode }),
      });
      expect(result).toBe(imageBase64);
    });

    it('should throw error on API failure', async () => {
      const mermaidCode = 'graph TD\nA[Start] --> B[End]';
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Server error'),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      await expect(mermaidToImage(mermaidCode)).rejects.toThrow('Failed to convert mermaid to image: 500 Server error');
    });

    it('should throw error on network failure', async () => {
      const mermaidCode = 'graph TD\nA[Start] --> B[End]';
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      await expect(mermaidToImage(mermaidCode)).rejects.toThrow('Failed to convert mermaid diagram to image: Network error');
    });
  });

  describe('extractAndConvertMermaidDiagrams', () => {
    it('should extract and convert mermaid diagrams', async () => {
      const content = 'Some text\n```mermaid\ngraph TD\nA --> B\n```\nMore text';
      const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAA...';
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ imageBase64 }),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      const result = await extractAndConvertMermaidDiagrams(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        mermaidCode: 'graph TD\nA --> B',
        imageBase64,
        startIndex: expect.any(Number),
        endIndex: expect.any(Number),
      });
    });

    it('should handle multiple mermaid diagrams', async () => {
      const content = 'Text\n```mermaid\ngraph TD\nA --> B\n```\nMore\n```mermaid\nsequenceDiagram\nA->>B: Hello\n```';
      const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAA...';
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ imageBase64 }),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      const result = await extractAndConvertMermaidDiagrams(content);

      expect(result).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should continue if one diagram conversion fails', async () => {
      const content = 'Text\n```mermaid\ngraph TD\nA --> B\n```\nMore\n```mermaid\nsequenceDiagram\nA->>B: Hello\n```';
      const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAA...';
      const successResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ imageBase64 }),
      };
      const errorResponse = {
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Error'),
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(successResponse as any)
        .mockResolvedValueOnce(errorResponse as any);

      const result = await extractAndConvertMermaidDiagrams(content);

      expect(result).toHaveLength(1); // Only first one succeeded
    });

    it('should return empty array if no mermaid diagrams found', async () => {
      const content = 'Just regular text with no mermaid diagrams';

      const result = await extractAndConvertMermaidDiagrams(content);

      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('removeMermaidBlocks', () => {
    it('should remove mermaid code blocks', () => {
      const content = 'Some text\n```mermaid\ngraph TD\nA --> B\n```\nMore text';
      const result = removeMermaidBlocks(content);

      expect(result).toBe('Some text\n\nMore text');
      expect(result).not.toContain('```mermaid');
      expect(result).not.toContain('graph TD');
    });

    it('should remove multiple mermaid blocks', () => {
      const content = 'Text\n```mermaid\ngraph TD\nA --> B\n```\nMiddle\n```mermaid\nsequenceDiagram\nA->>B\n```\nEnd';
      const result = removeMermaidBlocks(content);

      expect(result).toBe('Text\n\nMiddle\n\nEnd');
      expect(result).not.toContain('```mermaid');
    });

    it('should return original content if no mermaid blocks', () => {
      const content = 'Just regular text';
      const result = removeMermaidBlocks(content);

      expect(result).toBe(content);
    });

    it('should handle multiline mermaid diagrams', () => {
      const content = 'Start\n```mermaid\ngraph TD\nA[Node A]\nB[Node B]\nA --> B\n```\nEnd';
      const result = removeMermaidBlocks(content);

      expect(result).toBe('Start\n\nEnd');
    });
  });
});
