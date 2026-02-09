import { S3Client } from '@aws-sdk/client-s3';
import { logger } from '@shared/utils';

let s3Client: S3Client | null = null;

export const getS3Client = (): S3Client | null => {
  if (s3Client) {
    return s3Client;
  }

  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const region = process.env.S3_REGION || 'us-east-1';

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    logger.warn('S3 configuration missing, S3 client not initialized', { service: 's3Client' });
    return null;
  }

  try {
    s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Required for some S3 compatible storages like MinIO or Hetzner
    });
    
    logger.info('S3 client initialized successfully', { service: 's3Client', endpoint, region });
    return s3Client;
  } catch (error) {
    logger.error('Failed to initialize S3 client', error instanceof Error ? error : undefined, { service: 's3Client' });
    return null;
  }
};
