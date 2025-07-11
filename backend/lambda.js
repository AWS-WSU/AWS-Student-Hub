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
  ]
}); 