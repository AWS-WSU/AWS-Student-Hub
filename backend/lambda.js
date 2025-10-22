const serverless = require('serverless-http');
const app = require('./app');

// Handle CORS for OPTIONS requests directly
const handleCors = (event, context) => {
  const origin = event.headers?.origin || event.headers?.Origin;
  const allowedOrigins = [
    'https://wayneaws.dev',
    'https://www.wayneaws.dev', 
    'https://prizeversity.com',
    'https://www.prizeversity.com'
  ];
  
  // Check for Amplify domains
  const isAmplifyDomain = origin && origin.includes('.amplifyapp.com');
  
  if (allowedOrigins.includes(origin) || isAmplifyDomain) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Max-Age': '600'
      },
      body: ''
    };
  }
  
  return {
    statusCode: 403,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Credentials': 'false'
    },
    body: JSON.stringify({ message: 'CORS policy violation' })
  };
};

// Export the Lambda handler
module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Handle OPTIONS requests directly
  if (event.httpMethod === 'OPTIONS') {
    return handleCors(event, context);
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('Lambda Event:', JSON.stringify(event, null, 2));
  }

  const handler = serverless(app, {
    binary: [
      'application/javascript',
      'application/octet-stream',
      'application/xml',
      'font/eot',
      'font/opentype',
      'font/otf',
      'image/jpeg',
      'image/png',
      'image/svg+xml',
      'text/comma-separated-values',
      'text/css',
      'text/html',
      'text/javascript',
      'text/plain',
      'text/text',
      'text/xml'
    ],
    request: (request, event, context) => {
    },
    response: (response, event, context) => {
      // Ensure headers object exists
      if (!response.headers) {
        response.headers = {};
      }
      
      const origin = event.headers?.origin || event.headers?.Origin;
      const allowedOrigins = [
        'https://wayneaws.dev',
        'https://www.wayneaws.dev',
        'https://prizeversity.com',
        'https://www.prizeversity.com'
      ];
      
      // Check for Amplify domains
      const isAmplifyDomain = origin && origin.includes('.amplifyapp.com');
      
      if (origin && (allowedOrigins.includes(origin) || isAmplifyDomain)) {
        // Override API Gateway CORS with specific origin
        response.headers['Access-Control-Allow-Origin'] = origin;
        response.headers['Access-Control-Allow-Credentials'] = 'true';
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token';
      }
    }
  });

  return handler(event, context);
};