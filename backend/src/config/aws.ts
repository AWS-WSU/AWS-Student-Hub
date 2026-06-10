import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

import env from './env';

const s3Region = env.S3_REGION || env.AWS_REGION || 'us-east-1';

const credentials =
  env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      }
    : undefined;

export const s3Client = new S3Client({
  credentials,
  region: s3Region,
  followRegionRedirects: true,
});

export interface UploadableFile {
  buffer: Buffer;
  mimetype: string;
}

export const uploadToS3 = async (file: UploadableFile, key: string) => {
  const versionedKey = `${key}`;

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: env.S3_BUCKET_NAME || '',
      Key: versionedKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        'uploaded-at': new Date().toISOString(),
        version: Date.now().toString(),
      },
    },
  });

  return upload.done();
};

export const deleteFromS3 = async (key: string) => {
  const command = new DeleteObjectCommand({
    Bucket: env.S3_BUCKET_NAME || '',
    Key: key,
  });

  return s3Client.send(command);
};
