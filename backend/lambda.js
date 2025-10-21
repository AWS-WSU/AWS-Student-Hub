const serverless = require('serverless-http');
const app = require('./app');

// Export the Lambda handler
module.exports.handler = serverless(app, {
  // Binary media types for file uploads
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
    if (process.env.NODE_ENV !== 'production') {
      console.log('Lambda Event:', JSON.stringify(event, null, 2));
    }
  },
  response: (response, event, context) => {
    const origin = event.headers?.origin || event.headers?.Origin;
    const allowedOrigins = [
      'https://wayneaws.dev',
      'https://www.wayneaws.dev',
      'https://prizeversity.com',
      'https://www.prizeversity.com'
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers['Access-Control-Allow-Origin'] = origin;
      response.headers['Access-Control-Allow-Credentials'] = 'true';
    }
  }
});