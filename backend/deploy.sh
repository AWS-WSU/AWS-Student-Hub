#!/bin/bash

# AWS Student Hub Lambda Deployment Script

set -e

echo "🚀 Starting AWS Student Hub Lambda Deployment"

if [ -z "$1" ]; then
    echo "❌ Error: Environment parameter required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region]"
    echo "Example: ./deploy.sh dev 'mongodb://...' 'your-jwt-secret' 'https://mydomain.com,http://localhost:3000' 'my-bucket' 'AKIAXXXXX' 'secret' 'us-east-1'"
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

if [ -z "$MONGODB_URI" ]; then
    echo "❌ Error: MongoDB URI required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region]"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ Error: JWT Secret required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region]"
    exit 1
fi

if [ -z "$S3_BUCKET_NAME" ]; then
    echo "❌ Error: S3 Bucket Name required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region]"
    exit 1
fi

if [ -z "$S3_ACCESS_KEY_ID" ]; then
    echo "❌ Error: S3 Access Key ID required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region]"
    exit 1
fi

if [ -z "$S3_SECRET_ACCESS_KEY" ]; then
    echo "❌ Error: S3 Secret Access Key required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [jwt-secret] [cors-origin] [s3-bucket] [s3-access-key] [s3-secret-key] [s3-region]"
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

echo "📦 Installing dependencies..."
npm install --production

echo "🔨 Building deployment package..."
sam build

echo "🚀 Deploying to AWS..."
sam deploy \
    --stack-name "student-hub-backend-$ENVIRONMENT" \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        MongoDBURI="$MONGODB_URI" \
        JWTSecret="$JWT_SECRET" \
        CorsOrigin="$CORS_ORIGIN" \
        S3BucketName="$S3_BUCKET_NAME" \
        S3AccessKeyId="$S3_ACCESS_KEY_ID" \
        S3SecretAccessKey="$S3_SECRET_ACCESS_KEY" \
        S3Region="$S3_REGION" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-east-1 \
    --resolve-s3 \
    --no-confirm-changeset

echo "✅ Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update your frontend API base URL to the API Gateway endpoint"
echo "2. Test the deployment with: curl https://https://0jqaxbqaa2.execute-api.us-east-1.amazonaws.com/prod/api/health"
echo "3. Monitor logs with: sam logs -n StudentHubApi --stack-name student-hub-backend-$ENVIRONMENT --tail" 