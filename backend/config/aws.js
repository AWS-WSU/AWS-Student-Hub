const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  region: process.env.S3_REGION
});

const uploadToS3 = async (file, key) => {
  // Add version suffix for better cache management
  const versionedKey = `${key}`;
  
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: versionedKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'public, max-age=31536000, immutable', // 1 year cache with immutable flag
      Metadata: {
        'uploaded-at': new Date().toISOString(),
        'version': Date.now().toString()
      }
      // Public access controlled by bucket policy instead of ACL
    }
  });

  return upload.done();
};

const deleteFromS3 = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key
  });

  return s3Client.send(command);
};

module.exports = {
  s3Client,
  uploadToS3,
  deleteFromS3
};
