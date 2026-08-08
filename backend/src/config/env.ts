import dotenv from 'dotenv';

dotenv.config();

const optionalString = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value : undefined;
};

const stringValue = (key: string, fallback: string): string => {
  return optionalString(key) ?? fallback;
};

const numberValue = (key: string, fallback: number): number => {
  const value = optionalString(key);
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const booleanValue = (key: string): boolean | undefined => {
  const value = optionalString(key)?.toLowerCase();
  if (!value) return undefined;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return undefined;
};

const csvValue = (key: string): string[] | undefined => {
  const value = optionalString(key);
  if (!value) return undefined;

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const nodeEnv = stringValue('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';
const awsLambdaFunctionName = optionalString('AWS_LAMBDA_FUNCTION_NAME');
const isLambda = Boolean(awsLambdaFunctionName);
const jwtSecret = optionalString('JWT_SECRET');
const mongodbUri = optionalString('MONGODB_URI');

const env = {
  NODE_ENV: nodeEnv,
  IS_PRODUCTION: isProduction,
  IS_LAMBDA: isLambda,
  AWS_LAMBDA_FUNCTION_NAME: awsLambdaFunctionName,

  LOG_LEVEL: optionalString('LOG_LEVEL'),
  LOG_PRETTY: booleanValue('LOG_PRETTY'),

  PORT: numberValue('PORT', 5001),
  CORS_ORIGINS: csvValue('CORS_ORIGIN'),

  MONGODB_URI: mongodbUri,
  JWT_SECRET: jwtSecret,
  CHALLENGE_SIGNING_SECRET: optionalString('CHALLENGE_SIGNING_SECRET'),
  ADMIN_TOKEN: optionalString('ADMIN_TOKEN'),
  AUTH0_DOMAIN: optionalString('AUTH0_DOMAIN'),
  AUTH0_CLIENT_ID: optionalString('AUTH0_CLIENT_ID'),

  S3_ACCESS_KEY_ID: optionalString('S3_ACCESS_KEY_ID'),
  S3_SECRET_ACCESS_KEY: optionalString('S3_SECRET_ACCESS_KEY'),
  S3_REGION: optionalString('S3_REGION'),
  S3_BUCKET_NAME: optionalString('S3_BUCKET_NAME'),
  AWS_HUB_EVENT_THUMBNAILS: optionalString('AWS_HUB_EVENT_THUMBNAILS'),

  AWS_ADMIN_ACCESS_KEY_ID: optionalString('AWS_ADMIN_ACCESS_KEY_ID'),
  AWS_ADMIN_SECRET_ACCESS_KEY: optionalString('AWS_ADMIN_SECRET_ACCESS_KEY'),
  AWS_ACCESS_KEY_ID: optionalString('AWS_ACCESS_KEY_ID'),
  AWS_SECRET_ACCESS_KEY: optionalString('AWS_SECRET_ACCESS_KEY'),
  AWS_REGION: optionalString('AWS_REGION'),
  CUSTOM_AWS_REGION: stringValue('CUSTOM_AWS_REGION', 'us-east-1'),
  AWS_S3_BUCKET: optionalString('AWS_S3_BUCKET'),
  AWS_CHALLENGE_BUCKET: stringValue('AWS_CHALLENGE_BUCKET', 'wayne-aws-club-secrets-prod'),

  SMTP_HOST: stringValue('SMTP_HOST', 'smtp.gmail.com'),
  SMTP_PORT: numberValue('SMTP_PORT', 587),
  SMTP_ENCRYPTION: stringValue('SMTP_ENCRYPTION', 'STARTTLS'),
  SMTP_USER: optionalString('SMTP_USER'),
  SMTP_PASS: optionalString('SMTP_PASS'),

  DISCORD_BOT_TOKEN: optionalString('DISCORD_BOT_TOKEN'),
  DISCORD_GUILD_ID: optionalString('DISCORD_GUILD_ID'),
  DISCORD_CHANNEL_ID: optionalString('DISCORD_CHANNEL_ID'),
  AWS_CRED_ENCRYPTION_KEY: optionalString('AWS_CRED_ENCRYPTION_KEY'),

  PRIZEVERSITY_API_URL: stringValue('PRIZEVERSITY_API_URL', 'https://www.prizeversity.com'),
  PRIZEVERSITY_API_KEY: optionalString('PRIZEVERSITY_API_KEY'),
  PRIZEVERSITY_CLASSROOM_ID: optionalString('PRIZEVERSITY_CLASSROOM_ID'),
} as const;

export default env;
