import { Response, NextFunction } from 'express';
import multer from 'multer';
import { logger, validateRequest, sanitizeFilename } from '@shared/utils';
import { AdminAuthRequest } from '../../middleware/adminAuth';
import { SemanticChunkingService } from '../../services/semantic-chunking';
import prisma from '../../lib/prisma';
import { ensureDocumentContentSchema, getWeaviateClient } from './utils/weaviateUtils';
import { convertTextToMarkdown, splitIntoChunks } from './utils/textUtils';
import { vectorizeContent } from './utils/vectorizationUtils';
import { checkUploadQuota, updateUploadQuota } from '../../services/fileUploadQuotaService';
import { processDocumentSchema } from '../../validation/documentsSchemas';
import { getS3Client } from '../../utils/s3Client';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const documentsLogger = logger.child({ service: 'admin-backend', component: 'documents-controller' });

// Import pdf-parse
const pdfParse = require('pdf-parse');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

/**
 * Handle multer errors
 */
export function handleMulterError(err: unknown, req: AdminAuthRequest, res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      return;
    }
    res.status(400).json({ error: 'File upload error: ' + err.message });
    return;
  }
  if (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: 'File upload error: ' + errorMessage });
    return;
  }
  next();
}

/**
 * Process document endpoint
 */
export async function handleProcessDocument(req: AdminAuthRequest & { file?: Express.Multer.File }, res: Response): Promise<void> {
  try {
    // Early return if response already sent (validation middleware should have handled it)
    if (res.headersSent) {
      return;
    }
    
    // Body is already validated by validation middleware
    // But add defensive check in case validation middleware didn't run
    const body = req.body || {};
    const { chatbotId, blockId } = body;
    const file = req.file;
    const userId = req.adminUser?.id;
    
    // Defensive check for required fields (validation middleware should have caught this)
    if (!chatbotId || !blockId) {
      if (!res.headersSent) {
        res.status(400).json({ error: 'chatbotId and blockId are required' });
      }
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: 'No file provided or invalid file type. Only PDF files are allowed.' });
      return;
    }

    // Additional file type validation
    if (file.mimetype !== 'application/pdf') {
      res.status(400).json({ error: 'Invalid file type. Only PDF files are allowed.' });
      return;
    }

    // Validate file magic bytes (PDF signature)
    if (file.buffer.toString('ascii', 0, 4) !== '%PDF') {
      res.status(400).json({ error: 'File type does not match file content. Please upload a valid PDF file.' });
      return;
    }

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(file.originalname);

    // Upload to S3 if configured
    const s3Client = getS3Client();
    if (s3Client && process.env.S3_BUCKET_NAME) {
      try {
        const fileKey = `documents/${chatbotId}/${blockId}/${sanitizedFilename}`;
        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: fileKey,
          Body: file.buffer,
          ContentType: file.mimetype,
          Metadata: {
            chatbotId,
            blockId,
            originalName: file.originalname,
            uploadedBy: userId,
          }
        }));
        documentsLogger.info('File uploaded to S3', { fileKey });
      } catch (s3Error) {
        // Log but don't fail the request (legacy behavior)
        documentsLogger.error('Failed to upload file to S3', s3Error instanceof Error ? s3Error : undefined);
      }
    }

    // Check upload quota before processing
    const quotaCheck = await checkUploadQuota(userId, file.size);
    
    if (!quotaCheck.allowed) {
      res.status(400).json({
        error: quotaCheck.error || 'Upload quota exceeded',
        quota: {
          used: quotaCheck.usedBytes,
          limit: quotaCheck.limitBytes,
          remaining: 0,
        },
      });
      return;
    }

    // Ensure DocumentContent schema exists
    try {
      await ensureDocumentContentSchema();
    } catch (schemaError) {
      documentsLogger.error('Error ensuring DocumentContent schema', { error: schemaError instanceof Error ? schemaError : new Error(String(schemaError)) });
      // Continue without schema creation if it fails
    }

    // Verify the user owns the chatbot
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        ownerId: req.adminUser!.id,
      },
    });

    if (!chatbot) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'Chatbot not found or access denied' });
      }
      return;
    }

    // Convert PDF to text using pdf-parse
    let pdfData;
    try {
      pdfData = await pdfParse(file.buffer);
    } catch (pdfError) {
      documentsLogger.error('PDF parsing error', { error: pdfError instanceof Error ? pdfError : new Error(String(pdfError)) });
      if (!res.headersSent) {
        res.status(400).json({ error: 'Failed to parse PDF file. The file may be corrupted or not a valid PDF.' });
      }
      return;
    }
    
    const markdown = convertTextToMarkdown(pdfData.text);

    // Check if content is empty
    if (!markdown.trim()) {
      res.status(400).json({ error: 'PDF file appears to be empty or contains no readable text.' });
      return;
    }

    // Vectorize the content
    let vectors: Array<{ content: string; metadata: Record<string, unknown> }> = [];
    try {
      vectors = await vectorizeContent(markdown, chatbotId, blockId, file.originalname);
    } catch (vectorError) {
      documentsLogger.error('Vectorization error', { error: vectorError instanceof Error ? vectorError : new Error(String(vectorError)) });
      // Continue without vectors if vectorization fails
      vectors = [];
    }

    // Update quota after successful upload
    await updateUploadQuota(userId, file.size);

    // Return response with quota information
    res.json({
      markdown,
      vectors,
      fileName: sanitizedFilename,
      fileSize: file.size,
      quota: {
        used: quotaCheck.usedBytes + file.size,
        limit: quotaCheck.limitBytes,
        remaining: quotaCheck.remainingBytes - file.size,
        warning: quotaCheck.warning,
      },
    });
  } catch (error: unknown) {
    // Don't send error response if headers already sent (validation middleware may have sent a response)
    if (!res.headersSent) {
      documentsLogger.error('Error processing document', { error: error instanceof Error ? error : new Error(String(error)) });
      res.status(500).json({ error: 'Failed to process document' });
    }
  }
}

// Export multer middleware
export { upload };
