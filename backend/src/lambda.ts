import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  ScheduledEvent,
} from 'aws-lambda';
import serverless from 'serverless-http';

import app from './app';
import connectDB from './config/database';
import env from './config/env';
import { processEmailQueue } from './services/emailService';
import logger from './config/logger';

const log = logger.child({ module: 'lambda' });

const allowedOrigins = [
  'https://wayneaws.dev',
  'https://www.wayneaws.dev',
  'https://prizeversity.com',
  'https://www.prizeversity.com',
];

const getOrigin = (event: APIGatewayProxyEvent): string | undefined => {
  return event.headers?.origin || event.headers?.Origin || undefined;
};

const isAllowedOrigin = (origin: string | undefined): origin is string => {
  return Boolean(origin && (allowedOrigins.includes(origin) || origin.includes('.amplifyapp.com')));
};

const handleCors = (event: APIGatewayProxyEvent): APIGatewayProxyResult => {
  const origin = getOrigin(event);

  if (isAllowedOrigin(origin)) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Max-Age': '600',
      },
      body: '',
    };
  }

  return {
    statusCode: 403,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Credentials': 'false',
    },
    body: JSON.stringify({ message: 'CORS policy violation' }),
  };
};

const binaryContentTypes = [
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
  'text/xml',
];

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return handleCors(event);
  }

  if (!env.IS_PRODUCTION) {
    log.info('lambda event.', JSON.stringify(event, null, 2));
  }

  const lambdaHandler = serverless(app, {
    binary: binaryContentTypes,
    request: () => {},
    response: (
      response: { headers?: Record<string, string> },
      responseEvent: APIGatewayProxyEvent
    ) => {
      if (!response.headers) {
        response.headers = {};
      }

      const origin = getOrigin(responseEvent);

      if (isAllowedOrigin(origin)) {
        response.headers['Access-Control-Allow-Origin'] = origin;
        response.headers['Access-Control-Allow-Credentials'] = 'true';
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
        response.headers['Access-Control-Allow-Headers'] =
          'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token';
      }
    },
  });

  return lambdaHandler(event, context) as Promise<APIGatewayProxyResult>;
};

export const processEmailQueueHandler = async (
  _event: ScheduledEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  context.callbackWaitsForEmptyEventLoop = false;

  log.info('starting scheduled email queue processing.');

  try {
    await connectDB();
    const result = await processEmailQueue(20);

    log.info('email queue processing completed.', result);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Email queue processed',
        result,
      }),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('email queue processing error.', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: message,
      }),
    };
  }
};
