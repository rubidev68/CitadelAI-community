import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks for puppeteer, mermaidUtils, and logger
const {
  mockLaunch,
  mockBrowser,
  mockPage,
  mockSetViewport,
  mockSetContent,
  mockWaitForSelector,
  mockQuerySelector,
  mockScreenshot,
  mockClose,
  mockExtractMermaidBlocks,
  mockLogger,
} = vi.hoisted(() => {
  const mockSetViewport = vi.fn();
  const mockSetContent = vi.fn();
  const mockWaitForSelector = vi.fn();
  const mockScreenshot = vi.fn();
  const mockQuerySelector = vi.fn();
  const mockClose = vi.fn();

  const mockPage = {
    setViewport: mockSetViewport,
    setContent: mockSetContent,
    waitForSelector: mockWaitForSelector,
    $: mockQuerySelector,
  };

  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: mockClose,
  };

  const mockLaunch = vi.fn().mockResolvedValue(mockBrowser);

  const mockExtractMermaidBlocks = vi.fn();

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    mockLaunch,
    mockBrowser,
    mockPage,
    mockSetViewport,
    mockSetContent,
    mockWaitForSelector,
    mockQuerySelector,
    mockScreenshot,
    mockClose,
    mockExtractMermaidBlocks,
    mockLogger,
  };
});

vi.mock('puppeteer', () => ({
  default: {
    launch: (...args: unknown[]) => mockLaunch(...args),
  },
  launch: (...args: unknown[]) => mockLaunch(...args),
}));

vi.mock('../../utils/mermaidUtils', () => ({
  extractMermaidBlocks: (...args: unknown[]) => mockExtractMermaidBlocks(...args),
}));

vi.mock('@shared/utils', () => ({
  logger: mockLogger,
}));

describe('mermaidImageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mermaidToImage', () => {
    it('converts mermaid code to base64 image using puppeteer', async () => {
      const { mermaidToImage } = await import('../../services/mermaidImageService');

      const fakePng = 'BASE64PNG';
      mockWaitForSelector.mockResolvedValue(undefined);
      mockQuerySelector.mockResolvedValue({
        screenshot: mockScreenshot,
      } as any);
      mockScreenshot.mockResolvedValue(fakePng);

      const result = await mermaidToImage('graph TD; A-->B;');

      expect(mockLaunch).toHaveBeenCalledWith({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockSetViewport).toHaveBeenCalledWith({ width: 1200, height: 800 });
      expect(mockSetContent).toHaveBeenCalled();
      expect(mockWaitForSelector).toHaveBeenCalledWith('.mermaid svg', { timeout: 10000 });
      expect(mockScreenshot).toHaveBeenCalledWith({
        type: 'png',
        encoding: 'base64',
      });
      expect(result).toBe(fakePng);
      expect(mockClose).toHaveBeenCalled();
    });

    it('throws when mermaid element is not found', async () => {
      const { mermaidToImage } = await import('../../services/mermaidImageService');

      mockWaitForSelector.mockResolvedValue(undefined);
      mockQuerySelector.mockResolvedValue(null);

      await expect(mermaidToImage('graph TD; A-->B;')).rejects.toThrow(
        'Failed to convert mermaid diagram to image: Mermaid diagram not found',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error converting mermaid to image',
        expect.any(Error),
        expect.objectContaining({ service: 'mermaidImageService' }),
      );
      expect(mockClose).toHaveBeenCalled();
    });

    it('wraps puppeteer errors with friendly message', async () => {
      const { mermaidToImage } = await import('../../services/mermaidImageService');

      const error = new Error('Navigation timeout');
      mockLaunch.mockRejectedValueOnce(error);

      await expect(mermaidToImage('graph TD; A-->B;')).rejects.toThrow(
        'Failed to convert mermaid diagram to image: Navigation timeout',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error converting mermaid to image',
        error,
        expect.objectContaining({ service: 'mermaidImageService' }),
      );
    });
  });

  describe('extractAndConvertMermaidDiagrams', () => {
    it('extracts blocks and converts each to image', async () => {
      const { extractAndConvertMermaidDiagrams } = await import(
        '../../services/mermaidImageService'
      );

      mockExtractMermaidBlocks.mockReturnValue([
        { code: 'graph TD; A-->B;', startIndex: 10, endIndex: 30 },
        { code: 'graph TD; B-->C;', startIndex: 40, endIndex: 60 },
      ]);

      mockWaitForSelector.mockResolvedValue(undefined);
      mockQuerySelector.mockResolvedValue({
        screenshot: mockScreenshot,
      } as any);
      mockScreenshot.mockResolvedValueOnce('IMG1').mockResolvedValueOnce('IMG2');

      const result = await extractAndConvertMermaidDiagrams('some content');

      expect(mockExtractMermaidBlocks).toHaveBeenCalledWith('some content');
      expect(result).toEqual([
        {
          mermaidCode: 'graph TD; A-->B;',
          imageBase64: 'IMG1',
          startIndex: 10,
          endIndex: 30,
        },
        {
          mermaidCode: 'graph TD; B-->C;',
          imageBase64: 'IMG2',
          startIndex: 40,
          endIndex: 60,
        },
      ]);
    });

    it('continues with other diagrams when one conversion fails', async () => {
      const { extractAndConvertMermaidDiagrams } = await import(
        '../../services/mermaidImageService'
      );

      mockExtractMermaidBlocks.mockReturnValue([
        { code: 'bad graph', startIndex: 0, endIndex: 10 },
        { code: 'graph TD; A-->B;', startIndex: 20, endIndex: 40 },
      ]);

      // First call rejects, second resolves
      const error = new Error('Invalid mermaid syntax');
      mockWaitForSelector.mockRejectedValueOnce(error);
      mockWaitForSelector.mockResolvedValueOnce(undefined);
      mockQuerySelector.mockResolvedValue({
        screenshot: mockScreenshot,
      } as any);
      mockScreenshot.mockResolvedValue('GOODIMG');

      const result = await extractAndConvertMermaidDiagrams('content');

      expect(result).toHaveLength(1);
      expect(result[0].mermaidCode).toBe('graph TD; A-->B;');
      expect(result[0].imageBase64).toBe('GOODIMG');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to convert mermaid diagram',
        expect.objectContaining({
          startIndex: 0,
          error: 'Failed to convert mermaid diagram to image: Invalid mermaid syntax',
          service: 'mermaidImageService',
        }),
      );
    });

    it('returns empty array when no blocks found', async () => {
      const { extractAndConvertMermaidDiagrams } = await import(
        '../../services/mermaidImageService'
      );

      mockExtractMermaidBlocks.mockReturnValue([]);

      const result = await extractAndConvertMermaidDiagrams('no diagrams here');

      expect(result).toEqual([]);
      expect(mockLaunch).not.toHaveBeenCalled();
    });
  });
});

