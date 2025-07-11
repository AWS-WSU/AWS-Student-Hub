#!/bin/bash

# AWS Student Hub Lambda Deployment Script

set -e

echo "🚀 Starting AWS Student Hub Lambda Deployment"

if [ -z "$1" ]; then
    echo "❌ Error: Environment parameter required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [cors-origin]"
    echo "Example: ./deploy.sh dev 'mongodb://...' 'https://mydomain.com,http://localhost:3000'"
    exit 1
fi

ENVIRONMENT=$1
MONGODB_URI=${2:-""}
CORS_ORIGIN=${3:-"*"}

if [ -z "$MONGODB_URI" ]; then
    echo "❌ Error: MongoDB URI required"
    echo "Usage: ./deploy.sh [dev|staging|prod] [mongodb-uri] [cors-origin]"
    exit 1
fi

echo "📋 Deployment Configuration:"
echo "  Environment: $ENVIRONMENT"
echo "  CORS Origin: $CORS_ORIGIN"
echo "  MongoDB URI: [HIDDEN]"

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
        CorsOrigin="$CORS_ORIGIN" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-east-1 \
    --resolve-s3 \
    --confirm-changeset

echo "✅ Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update your frontend API base URL to the API Gateway endpoint"
echo "2. Test the deployment with: curl https://https://0jqaxbqaa2.execute-api.us-east-1.amazonaws.com/prod/api/health"
echo "3. Monitor logs with: sam logs -n StudentHubApi --stack-name student-hub-backend-$ENVIRONMENT --tail" 