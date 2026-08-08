#!/bin/bash

set -e

echo "starting aws student hub lambda deployment."

if [ -z "$1" ]; then
    echo "error: environment parameter required."
    echo "usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [admin-token] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region] [aws-admin-access-key] [aws-admin-secret-key] [aws-region] [aws-s3-bucket] [smtp-host] [smtp-port] [smtp-encryption] [smtp-user] [smtp-pass] [discord-token] [discord-guild-id] [discord-channel-id] [aws-cred-key] [aws-event-thumbnails-bucket] [auth0-domain] [auth0-client-id]."
    echo "example: ./deploy.sh dev 'mongodb-uri' 'your-admin-token' 'your-jwt-secret' 'https://mydomain.com,http://localhost:3000' 'my-bucket' 'access-key' 'secret' 'us-east-2' 'discord-token' 'guild-id' 'channel-id' 'smtp@email.com' 'smtp-pass' 'encryption-key'."
    exit 1
fi

ENVIRONMENT=$1
MONGODB_URI=${2:-""}
ADMIN_TOKEN=${3:-""}
JWT_SECRET=${4:-""}
CORS_ORIGIN=${5:-"*"}
S3_BUCKET_NAME=${6:-""}
S3_ACCESS_KEY_ID=${7:-""}
S3_SECRET_ACCESS_KEY=${8:-""}
S3_REGION=${9:-"us-east-2"}
AWS_ADMIN_ACCESS_KEY_ID=${10:-""}
AWS_ADMIN_SECRET_ACCESS_KEY=${11:-""}
CUSTOM_AWS_REGION=${12:-"us-east-1"}
AWS_S3_BUCKET=${13:-""}
SMTP_HOST=${14:-"smtp.gmail.com"}
SMTP_PORT=${15:-"587"}
SMTP_ENCRYPTION=${16:-"STARTTLS"}
SMTP_USER=${17:-""}
SMTP_PASS=${18:-""}
DISCORD_BOT_TOKEN=${19:-""}
DISCORD_GUILD_ID=${20:-""}
DISCORD_CHANNEL_ID=${21:-""}
AWS_CRED_ENCRYPTION_KEY=${22:-""}
AWS_HUB_EVENT_THUMBNAILS=${23:-"aws-student-hub-event-thumbnails"}
AUTH0_DOMAIN=${24:-""}
AUTH0_CLIENT_ID=${25:-""}

if [ -z "$MONGODB_URI" ] || [ -z "$ADMIN_TOKEN" ] || [ -z "$JWT_SECRET" ] || [ -z "$S3_BUCKET_NAME" ] || [ -z "$S3_ACCESS_KEY_ID" ] || [ -z "$S3_SECRET_ACCESS_KEY" ] || [ -z "$AWS_ADMIN_ACCESS_KEY_ID" ] || [ -z "$AWS_ADMIN_SECRET_ACCESS_KEY" ] || [ -z "$AWS_S3_BUCKET" ] || [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ] || [ -z "$DISCORD_BOT_TOKEN" ] || [ -z "$DISCORD_GUILD_ID" ] || [ -z "$DISCORD_CHANNEL_ID" ] || [ -z "$AWS_CRED_ENCRYPTION_KEY" ]; then
    echo "error: missing required parameters."
    echo "usage: ./deploy.sh [env] [mongodb-uri] [admin-token] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region] [aws-admin-access-key] [aws-admin-secret-key] [aws-region] [aws-s3-bucket] [smtp-host] [smtp-port] [smtp-encryption] [smtp-user] [smtp-pass] [discord-token] [discord-guild-id] [discord-channel-id] [aws-cred-key]."
    exit 1
fi

echo "deployment configuration."
echo "environment: $ENVIRONMENT."
echo "cors origin: $CORS_ORIGIN."
echo "s3 bucket: $S3_BUCKET_NAME."
echo "s3 region: $S3_REGION."
echo "aws region: $CUSTOM_AWS_REGION."
echo "aws s3 bucket: $AWS_S3_BUCKET."
echo "smtp host: $SMTP_HOST."
echo "smtp port: $SMTP_PORT."
echo "all sensitive values: [hidden]."

echo "installing dependencies."
bun install --frozen-lockfile

echo "compiling typescript."
bun run build

echo "pruning development dependencies."
rm -rf node_modules
bun install --frozen-lockfile --production --os=linux --cpu=x64

echo "building deployment package."
sam build

echo "deploying to aws."
SAM_PARAMETERS=(
  "Environment=$ENVIRONMENT"
  "MongoDbUri=$MONGODB_URI"
  "AdminToken=$ADMIN_TOKEN"
  "JwtSecret=$JWT_SECRET"
  "CorsOrigin=$CORS_ORIGIN"
  "S3BucketName=$S3_BUCKET_NAME"
  "S3AccessKeyId=$S3_ACCESS_KEY_ID"
  "S3SecretAccessKey=$S3_SECRET_ACCESS_KEY"
  "S3Region=$S3_REGION"
  "AwsAdminAccessKeyId=$AWS_ADMIN_ACCESS_KEY_ID"
  "AwsAdminSecretAccessKey=$AWS_ADMIN_SECRET_ACCESS_KEY"
  "CustomAwsRegion=$CUSTOM_AWS_REGION"
  "AwsS3Bucket=$AWS_S3_BUCKET"
  "SmtpHost=$SMTP_HOST"
  "SmtpPort=$SMTP_PORT"
  "SmtpEncryption=$SMTP_ENCRYPTION"
  "SmtpUser=$SMTP_USER"
  "SmtpPass=$SMTP_PASS"
  "DiscordBotToken=$DISCORD_BOT_TOKEN"
  "DiscordGuildId=$DISCORD_GUILD_ID"
  "DiscordChannelId=$DISCORD_CHANNEL_ID"
  "AwsCredEncryptionKey=$AWS_CRED_ENCRYPTION_KEY"
  "AwsHubEventThumbnails=$AWS_HUB_EVENT_THUMBNAILS"
)

# Auth0 is optional until Google sign-in is configured for this environment.
if [ -n "$AUTH0_DOMAIN" ]; then
  SAM_PARAMETERS+=("Auth0Domain=$AUTH0_DOMAIN")
fi

if [ -n "$AUTH0_CLIENT_ID" ]; then
  SAM_PARAMETERS+=("Auth0ClientId=$AUTH0_CLIENT_ID")
fi

sam deploy \
  --stack-name "student-hub-backend-$ENVIRONMENT" \
  --region "us-east-1" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --resolve-s3 \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${SAM_PARAMETERS[@]}"

echo "deployment completed successfully."
echo ""
echo "next steps."
echo "1. update your frontend api base url to the api gateway endpoint."
echo "2. test the deployment with curl https://your-api-gateway-url/health."
echo "3. monitor logs with sam logs -n StudentHubApi --stack-name student-hub-backend-$ENVIRONMENT --tail."
