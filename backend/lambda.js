const serverless = require('serverless-http');
const app = require('./app');

// Export the Lambda handler
module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
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
        response.headers['Access-Control-Allow-Origin'] = origin;
        response.headers['Access-Control-Allow-Credentials'] = 'false';
      } else {
        // Allow all origins for now to fix the immediate issue
        response.headers['Access-Control-Allow-Origin'] = '*';
        response.headers['Access-Control-Allow-Credentials'] = 'false';
      }
    }
  });

  return handler(event, context);
};