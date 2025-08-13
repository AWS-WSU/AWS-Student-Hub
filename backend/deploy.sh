#!/bin/bash

# AWS Student Hub Lambda Deployment Script

set -e

echo "🚀 Starting AWS Student Hub Lambda Deployment"

if [ -z "$1" ]; then
    echo "❌ Error: Environment parameter required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region] [discord-token] [discord-guild-id] [discord-channel-id] [smtp-user] [smtp-pass] [aws-cred-key]"
    echo "Example: ./deploy.sh dev 'mongodb://...' 'your-jwt-secret' 'https://mydomain.com,http://localhost:3000' 'my-bucket' 'AKIAXXXXX' 'secret' 'us-east-1' 'discord-token' 'guild-id' 'channel-id' 'smtp@email.com' 'smtp-pass' 'encryption-key'"
    exit 1
fi

ENVIRONMENT=$1
MONGODB_URI=${2:-""}
JWT_SECRET=${3:-""}
CORS_ORIGIN=${4:-"*"}
S3_BUCKET_NAME=${5:-""}
S3_ACCESS_KEY_ID=${6:-""}
S3_SECRET_ACCESS_KEY=${7:-""}
S3_REGION=${8:-"us-east-1"}
ADMIN_TOKEN=${9:-""}
AWS_ADMIN_ACCESS_KEY_ID=${10:-""}
AWS_ADMIN_SECRET_ACCESS_KEY=${11:-""}
AWS_S3_BUCKET=${12:-""}
SMTP_HOST=${13:-""}
SMTP_PORT=${14:-""}
SMTP_ENCRYPTION=${15:-""}
SMTP_USER=${16:-""}
SMTP_PASS=${17:-""}
DISCORD_BOT_TOKEN=${18:-""}
DISCORD_GUILD_ID=${19:-""}
DISCORD_CHANNEL_ID=${20:-""}
AWS_CRED_ENCRYPTION_KEY=${21:-""}

if [ -z "$MONGODB_URI" ]; then
    echo "❌ Error: MongoDB URI required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region] [discord-token] [discord-guild-id] [discord-channel-id] [smtp-user] [smtp-pass] [aws-cred-key]"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ Error: JWT Secret required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region] [discord-token] [discord-guild-id] [discord-channel-id] [smtp-user] [smtp-pass] [aws-cred-key]"
    exit 1
fi

if [ -z "$S3_BUCKET_NAME" ]; then
    echo "❌ Error: S3 Bucket Name required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region] [discord-token] [discord-guild-id] [discord-channel-id] [smtp-user] [smtp-pass] [aws-cred-key]"
    exit 1
fi

if [ -z "$S3_ACCESS_KEY_ID" ]; then
    echo "❌ Error: S3 Access Key ID required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region] [discord-token] [discord-guild-id] [discord-channel-id] [smtp-user] [smtp-pass] [aws-cred-key]"
    exit 1
fi

if [ -z "$S3_SECRET_ACCESS_KEY" ]; then
    echo "❌ Error: S3 Secret Access Key required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region] [discord-token] [discord-guild-id] [discord-channel-id] [smtp-user] [smtp-pass] [aws-cred-key]"
    exit 1
fi

# Add validation for all other required parameters
if [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ Error: Admin Token required"
    exit 1
fi

if [ -z "$AWS_ADMIN_ACCESS_KEY_ID" ]; then
    echo "❌ Error: AWS Admin Access Key ID required"
    exit 1
fi

if [ -z "$AWS_ADMIN_SECRET_ACCESS_KEY" ]; then
    echo "❌ Error: AWS Admin Secret Access Key required"
    exit 1
fi

if [ -z "$AWS_S3_BUCKET" ]; then
    echo "❌ Error: AWS S3 Bucket required"
    exit 1
fi

if [ -z "$DISCORD_BOT_TOKEN" ]; then
    echo "❌ Error: Discord Bot Token required"
    exit 1
fi

if [ -z "$AWS_CRED_ENCRYPTION_KEY" ]; then
    echo "❌ Error: AWS Credential Encryption Key required"
    exit 1
fi

echo "📋 Deployment Configuration:"
echo "  Environment: $ENVIRONMENT"
echo "  CORS Origin: $CORS_ORIGIN"
echo "  S3 Bucket: $S3_BUCKET_NAME"
echo "  S3 Region: $S3_REGION"
echo "  MongoDB URI: [HIDDEN]"
echo "  JWT Secret: [HIDDEN]"
echo "  S3 Access Key: [HIDDEN]"
echo "  S3 Secret Key: [HIDDEN]"
echo "  Discord Bot Token: [HIDDEN]"
echo "  Discord Guild ID: [HIDDEN]"
echo "  Discord Channel ID: [HIDDEN]"
echo "  SMTP User: [HIDDEN]"
echo "  SMTP Pass: [HIDDEN]"
echo "  AWS Cred Encryption Key: [HIDDEN]"

echo "📦 Installing dependencies..."
npm install --production

echo "🔨 Building deployment package..."
sam build

echo "🚀 Deploying to AWS..."
sam deploy \
  --stack-name "student-hub-backend-$ENVIRONMENT" \
  --region "us-east-1" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    MongoDbUri="$MONGODB_URI" \
    JwtSecret="$JWT_SECRET" \
    CorsOrigin="$CORS_ORIGIN" \
    S3BucketName="$S3_BUCKET_NAME" \
    S3AccessKeyId="$S3_ACCESS_KEY_ID" \
    S3SecretAccessKey="$S3_SECRET_ACCESS_KEY" \
    S3Region="$S3_REGION" \
    AdminToken="$ADMIN_TOKEN" \
    AwsAdminAccessKeyId="$AWS_ADMIN_ACCESS_KEY_ID" \
    AwsAdminSecretAccessKey="$AWS_ADMIN_SECRET_ACCESS_KEY" \
    AwsS3Bucket="$AWS_S3_BUCKET" \
    SmtpHost="$SMTP_HOST" \
    SmtpPort="$SMTP_PORT" \
    SmtpEncryption="$SMTP_ENCRYPTION" \
    SmtpUser="$SMTP_USER" \
    SmtpPass="$SMTP_PASS" \
    DiscordBotToken="$DISCORD_BOT_TOKEN" \
    DiscordGuildId="$DISCORD_GUILD_ID" \
    DiscordChannelId="$DISCORD_CHANNEL_ID" \
    AwsCredEncryptionKey="$AWS_CRED_ENCRYPTION_KEY"

echo "✅ Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update your frontend API base URL to the API Gateway endpoint"
echo "2. Test the deployment with: curl https://https://0jqaxbqaa2.execute-api.us-east-1.amazonaws.com/prod/api/health"
echo "3. Monitor logs with: sam logs -n StudentHubApi --stack-name student-hub-backend-$ENVIRONMENT --tail"