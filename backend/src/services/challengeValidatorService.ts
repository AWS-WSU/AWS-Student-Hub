import crypto from 'crypto';

import type { IChallengeDocument } from '../models/Challenge';
import type { IChallengeProgressDocument } from '../models/ChallengeProgress';
import User, { IUserDocument } from '../models/User';

export interface ChallengeValidatorContext {
  user: IUserDocument;
  challenge: IChallengeDocument;
  progress: IChallengeProgressDocument;
}

export interface ChallengeValidationResult {
  accepted: boolean;
  message: string;
  publicDetails?: Record<string, unknown>;
  privateDetails?: Record<string, unknown>;
}

export interface ChallengeValidator {
  type: string;
  validate(
    config: Record<string, unknown>,
    payload: unknown,
    context: ChallengeValidatorContext
  ): Promise<ChallengeValidationResult>;
  sanitizePayload?(payload: unknown): Record<string, unknown>;
}

export class ChallengeValidatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChallengeValidatorError';
  }
}

interface AwsSecretValidationConfig {
  type: 'aws_secret';
  source?: 'user_next_challenge_password' | 'static_hash';
  expectedValueHash?: string;
  hashAlgorithm?: 'sha256';
  trimSubmission?: boolean;
  caseSensitive?: boolean;
  acceptedPrefixes?: string[];
}

interface AwsSecretSubmissionPayload {
  secret?: string;
  answer?: string;
  value?: string;
}

const validators = new Map<string, ChallengeValidator>();

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const cleanString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const normalizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.map(cleanString).filter(Boolean);
};

const normalizeAwsSecretConfig = (config: Record<string, unknown>): AwsSecretValidationConfig => {
  if (config.type !== 'aws_secret') {
    throw new ChallengeValidatorError('Invalid AWS secret validator config type.');
  }

  const source =
    config.source === 'static_hash' || config.source === 'user_next_challenge_password'
      ? config.source
      : undefined;
  const expectedValueHash = cleanString(config.expectedValueHash) || undefined;

  if (source === 'static_hash' && !expectedValueHash) {
    throw new ChallengeValidatorError(
      'AWS secret validator using static_hash requires expectedValueHash.'
    );
  }

  return {
    type: 'aws_secret',
    source,
    expectedValueHash,
    hashAlgorithm: 'sha256',
    trimSubmission: typeof config.trimSubmission === 'boolean' ? config.trimSubmission : undefined,
    caseSensitive: typeof config.caseSensitive === 'boolean' ? config.caseSensitive : undefined,
    acceptedPrefixes: normalizeStringArray(config.acceptedPrefixes),
  };
};

const normalizeAwsSecretPayload = (payload: unknown): AwsSecretSubmissionPayload => {
  if (!isRecord(payload)) return {};
  return {
    secret: cleanString(payload.secret) || undefined,
    answer: cleanString(payload.answer) || undefined,
    value: cleanString(payload.value) || undefined,
  };
};

const normalizeSecret = (secret: string, config: AwsSecretValidationConfig): string => {
  const trimSubmission = config.trimSubmission !== false;
  const caseSensitive = config.caseSensitive !== false;
  const trimmed = trimSubmission ? secret.trim() : secret;
  return caseSensitive ? trimmed : trimmed.toLowerCase();
};

const hashSecret = (secret: string): string => {
  return crypto.createHash('sha256').update(secret).digest('hex');
};

const extractSubmittedSecret = (
  payload: AwsSecretSubmissionPayload,
  config: AwsSecretValidationConfig
): string => {
  const rawSecret = cleanString(payload.secret || payload.answer || payload.value);
  if (!rawSecret) return '';

  const acceptedPrefixes = config.acceptedPrefixes || ['next_password='];
  const matchingPrefix = acceptedPrefixes.find((prefix) => rawSecret.startsWith(prefix));

  if (matchingPrefix) {
    return rawSecret.slice(matchingPrefix.length);
  }

  return rawSecret;
};

const getExpectedSecret = async (
  config: AwsSecretValidationConfig,
  context: ChallengeValidatorContext
): Promise<string | null> => {
  if (config.source === 'static_hash') return null;

  const userWithSecret = await User.findById(context.user._id).select('+nextChallengePassword');
  return userWithSecret?.nextChallengePassword || null;
};

const awsSecretValidator: ChallengeValidator = {
  type: 'aws_secret',

  async validate(rawConfig, rawPayload, context) {
    const config = normalizeAwsSecretConfig(rawConfig);
    const payload = normalizeAwsSecretPayload(rawPayload);
    const submittedSecret = extractSubmittedSecret(payload, config);
    if (!submittedSecret) {
      return {
        accepted: false,
        message: 'Secret value is required.',
      };
    }

    const normalizedSubmittedSecret = normalizeSecret(submittedSecret, config);
    const submittedHash = hashSecret(normalizedSubmittedSecret);

    if (config.expectedValueHash) {
      return {
        accepted: submittedHash === config.expectedValueHash,
        message:
          submittedHash === config.expectedValueHash
            ? 'Challenge secret accepted.'
            : 'Challenge secret did not match.',
        privateDetails: {
          mode: 'static_hash',
          hashAlgorithm: config.hashAlgorithm || 'sha256',
        },
      };
    }

    const expectedSecret = await getExpectedSecret(config, context);
    if (!expectedSecret) {
      throw new ChallengeValidatorError('No AWS challenge secret is assigned to this user.');
    }

    const normalizedExpectedSecret = normalizeSecret(expectedSecret, config);
    const expectedHash = hashSecret(normalizedExpectedSecret);
    const accepted = submittedHash === expectedHash;

    return {
      accepted,
      message: accepted ? 'Challenge secret accepted.' : 'Challenge secret did not match.',
      privateDetails: {
        mode: 'user_next_challenge_password',
        hashAlgorithm: 'sha256',
      },
    };
  },

  sanitizePayload(payload) {
    const normalizedPayload = normalizeAwsSecretPayload(payload);
    return {
      submitted: Boolean(
        normalizedPayload.secret || normalizedPayload.answer || normalizedPayload.value
      ),
      secret: '[redacted]',
    };
  },
};

export const registerChallengeValidator = (validator: ChallengeValidator): void => {
  validators.set(validator.type, validator);
};

export const getChallengeValidator = (type: string): ChallengeValidator => {
  const validator = validators.get(type);
  if (!validator) {
    throw new ChallengeValidatorError(`Unsupported challenge validator type: ${type}`);
  }
  return validator;
};

export const validateChallengeSubmission = async (
  config: Record<string, unknown>,
  payload: unknown,
  context: ChallengeValidatorContext
): Promise<ChallengeValidationResult> => {
  const type = cleanString(config.type);
  if (!type) {
    throw new ChallengeValidatorError('Challenge validation type is missing.');
  }

  const validator = getChallengeValidator(type);
  return validator.validate(config, payload, context);
};

export const sanitizeChallengeSubmissionPayload = (
  config: Record<string, unknown>,
  payload: unknown
): Record<string, unknown> => {
  const type = cleanString(config.type);
  const validator = type ? validators.get(type) : null;
  if (validator?.sanitizePayload) {
    return validator.sanitizePayload(payload);
  }

  if (!isRecord(payload)) return {};
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('key')
      ) {
        return [key, '[redacted]'];
      }
      return [key, typeof value === 'string' ? value.slice(0, 80) : '[provided]'];
    })
  );
};

registerChallengeValidator(awsSecretValidator);
