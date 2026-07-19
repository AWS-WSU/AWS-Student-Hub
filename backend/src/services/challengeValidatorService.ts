import crypto from 'crypto';

import type { IChallengeDocument } from '../models/Challenge';
import type { IChallengeProgressDocument } from '../models/ChallengeProgress';
import User, { IUserDocument } from '../models/User';
import {
  buildCipheredSealExpectedSequence,
  CIPHERED_SEAL_VALIDATOR_TYPE,
  compareCipheredSealSequence,
  getCipheredSealSuccessMessage,
  isCipheredSealSequence,
  normalizeCipheredSealConfig,
} from './cipheredSealService';

export interface ChallengeValidatorContext {
  user: IUserDocument;
  challenge: IChallengeDocument;
  progress: IChallengeProgressDocument;
}

export type ChallengeValidationOutcome = 'accepted' | 'pending_review' | 'rejected';

export interface ChallengeValidationResult {
  accepted: boolean;
  outcome?: ChallengeValidationOutcome;
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

interface StaticSecretValidationConfig {
  type: 'static_secret';
  expectedValue?: string;
  expectedValueHash?: string;
  hashAlgorithm?: 'sha256';
  trimSubmission?: boolean;
  caseSensitive?: boolean;
  acceptedPrefixes?: string[];
}

interface ManualReviewValidationConfig {
  type: 'manual_review';
  minLength?: number;
  maxLength?: number;
  submittedMessage?: string;
}

interface GenericProofSubmissionPayload {
  secret?: string;
  answer?: string;
  value?: string;
  proof?: string;
  text?: string;
  link?: string;
  url?: string;
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

const normalizeBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

const normalizePositiveInteger = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
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

const normalizeStaticSecretConfig = (
  config: Record<string, unknown>
): StaticSecretValidationConfig => {
  if (config.type !== 'static_secret') {
    throw new ChallengeValidatorError('Invalid static secret validator config type.');
  }

  const expectedValue = cleanString(config.expectedValue) || undefined;
  const expectedValueHash = cleanString(config.expectedValueHash) || undefined;

  if (!expectedValue && !expectedValueHash) {
    throw new ChallengeValidatorError(
      'Static secret validation requires expectedValue or expectedValueHash.'
    );
  }

  return {
    type: 'static_secret',
    expectedValue,
    expectedValueHash,
    hashAlgorithm: 'sha256',
    trimSubmission: normalizeBoolean(config.trimSubmission),
    caseSensitive: normalizeBoolean(config.caseSensitive),
    acceptedPrefixes: normalizeStringArray(config.acceptedPrefixes),
  };
};

const normalizeManualReviewConfig = (
  config: Record<string, unknown>
): ManualReviewValidationConfig => {
  if (config.type !== 'manual_review') {
    throw new ChallengeValidatorError('Invalid manual review validator config type.');
  }

  const minLength = normalizePositiveInteger(config.minLength);
  const maxLength = normalizePositiveInteger(config.maxLength);

  if (minLength && maxLength && minLength > maxLength) {
    throw new ChallengeValidatorError('Manual review minLength cannot exceed maxLength.');
  }

  return {
    type: 'manual_review',
    minLength,
    maxLength,
    submittedMessage: cleanString(config.submittedMessage) || undefined,
  };
};

const normalizeGenericProofPayload = (payload: unknown): GenericProofSubmissionPayload => {
  if (!isRecord(payload)) return {};
  return {
    secret: cleanString(payload.secret) || undefined,
    answer: cleanString(payload.answer) || undefined,
    value: cleanString(payload.value) || undefined,
    proof: cleanString(payload.proof) || undefined,
    text: cleanString(payload.text) || undefined,
    link: cleanString(payload.link) || undefined,
    url: cleanString(payload.url) || undefined,
  };
};

const normalizeSecret = (
  secret: string,
  config: AwsSecretValidationConfig | StaticSecretValidationConfig
): string => {
  const trimSubmission = config.trimSubmission !== false;
  const caseSensitive = config.caseSensitive !== false;
  const trimmed = trimSubmission ? secret.trim() : secret;
  return caseSensitive ? trimmed : trimmed.toLowerCase();
};

const hashSecret = (secret: string): string => {
  return crypto.createHash('sha256').update(secret).digest('hex');
};

const extractSubmittedSecret = (
  payload: AwsSecretSubmissionPayload | GenericProofSubmissionPayload,
  config: AwsSecretValidationConfig | StaticSecretValidationConfig
): string => {
  const proof = 'proof' in payload ? payload.proof : undefined;
  const text = 'text' in payload ? payload.text : undefined;
  const rawSecret = cleanString(payload.secret || payload.answer || payload.value || proof || text);
  if (!rawSecret) return '';

  const acceptedPrefixes = config.acceptedPrefixes || ['next_password='];
  const matchingPrefix = acceptedPrefixes.find((prefix) => rawSecret.startsWith(prefix));

  if (matchingPrefix) {
    return rawSecret.slice(matchingPrefix.length);
  }

  return rawSecret;
};

const extractManualReviewProof = (payload: GenericProofSubmissionPayload): string => {
  return cleanString(
    payload.proof || payload.text || payload.answer || payload.value || payload.secret
  );
};

const buildStaticSecretHash = (secret: string, config: StaticSecretValidationConfig): string => {
  return hashSecret(normalizeSecret(secret, config));
};

const getCipheredSealConfig = (config: Record<string, unknown>) => {
  try {
    return normalizeCipheredSealConfig(config);
  } catch (error: unknown) {
    throw new ChallengeValidatorError(
      error instanceof Error ? error.message : 'Invalid Ciphered Seal validator configuration.'
    );
  }
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

const staticSecretValidator: ChallengeValidator = {
  type: 'static_secret',

  async validate(rawConfig, rawPayload) {
    const config = normalizeStaticSecretConfig(rawConfig);
    const payload = normalizeGenericProofPayload(rawPayload);
    const submittedSecret = extractSubmittedSecret(payload, config);
    if (!submittedSecret) {
      return {
        accepted: false,
        outcome: 'rejected',
        message: 'Secret value is required.',
      };
    }

    const expectedHash =
      config.expectedValueHash || buildStaticSecretHash(config.expectedValue || '', config);
    const submittedHash = buildStaticSecretHash(submittedSecret, config);
    const accepted = submittedHash === expectedHash;

    return {
      accepted,
      outcome: accepted ? 'accepted' : 'rejected',
      message: accepted ? 'Challenge secret accepted.' : 'Challenge secret did not match.',
      privateDetails: {
        mode: 'static_secret',
        hashAlgorithm: config.hashAlgorithm || 'sha256',
      },
    };
  },

  sanitizePayload(payload) {
    const normalizedPayload = normalizeGenericProofPayload(payload);
    return {
      submitted: Boolean(
        normalizedPayload.secret ||
        normalizedPayload.answer ||
        normalizedPayload.value ||
        normalizedPayload.proof ||
        normalizedPayload.text
      ),
      secret: '[redacted]',
    };
  },
};

const manualReviewValidator: ChallengeValidator = {
  type: 'manual_review',

  async validate(rawConfig, rawPayload) {
    const config = normalizeManualReviewConfig(rawConfig);
    const payload = normalizeGenericProofPayload(rawPayload);
    const proof = extractManualReviewProof(payload);
    const link = cleanString(payload.link || payload.url);

    if (!proof && !link) {
      return {
        accepted: false,
        outcome: 'rejected',
        message: 'Submission proof is required.',
      };
    }

    if (config.minLength && proof.length > 0 && proof.length < config.minLength) {
      return {
        accepted: false,
        outcome: 'rejected',
        message: `Submission proof must be at least ${config.minLength} characters.`,
      };
    }

    if (config.maxLength && proof.length > config.maxLength) {
      return {
        accepted: false,
        outcome: 'rejected',
        message: `Submission proof must be ${config.maxLength} characters or fewer.`,
      };
    }

    return {
      accepted: true,
      outcome: 'pending_review',
      message: config.submittedMessage || 'Submission received for review.',
      publicDetails: {
        reviewRequired: true,
      },
      privateDetails: {
        hasProof: Boolean(proof),
        hasLink: Boolean(link),
      },
    };
  },

  sanitizePayload(payload) {
    const normalizedPayload = normalizeGenericProofPayload(payload);
    const proof = extractManualReviewProof(normalizedPayload);
    const link = cleanString(normalizedPayload.link || normalizedPayload.url);

    return {
      submitted: Boolean(proof || link),
      proofPreview: proof ? proof.slice(0, 500) : undefined,
      link: link ? link.slice(0, 300) : undefined,
    };
  },
};

const cipheredSealValidator: ChallengeValidator = {
  type: CIPHERED_SEAL_VALIDATOR_TYPE,

  async validate(rawConfig, rawPayload, context) {
    getCipheredSealConfig(rawConfig);
    const sequence = isRecord(rawPayload) ? rawPayload.sequence : undefined;

    if (!isCipheredSealSequence(sequence)) {
      return {
        accepted: false,
        outcome: 'rejected',
        message: 'Invoke each of the four wards exactly once before submitting.',
      };
    }

    const expectedSequence = buildCipheredSealExpectedSequence(context.challenge, context.user);
    const accepted = compareCipheredSealSequence(sequence, expectedSequence);

    return {
      accepted,
      outcome: accepted ? 'accepted' : 'rejected',
      message: accepted
        ? getCipheredSealSuccessMessage(rawConfig)
        : 'The shrine rejected that invocation order. Recheck the ward states and visible order.',
      publicDetails: {
        invokedWardCount: sequence.length,
      },
      privateDetails: {
        personalizedLayout: true,
        challengeVersion: context.challenge.version,
      },
    };
  },

  sanitizePayload(payload) {
    const sequence = isRecord(payload) && Array.isArray(payload.sequence) ? payload.sequence : [];
    return {
      submitted: sequence.length > 0,
      invokedWardCount: sequence.length,
      sequence: '[redacted]',
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

export const prepareChallengeValidationConfigForStorage = (
  config: Record<string, unknown>
): Record<string, unknown> => {
  const type = cleanString(config.type);
  if (!type) {
    throw new ChallengeValidatorError('Challenge validation type is missing.');
  }

  if (type === 'static_secret') {
    const normalizedConfig = normalizeStaticSecretConfig({ ...config, type });
    const expectedValueHash =
      normalizedConfig.expectedValueHash ||
      buildStaticSecretHash(normalizedConfig.expectedValue || '', normalizedConfig);

    return {
      type,
      expectedValueHash,
      hashAlgorithm: 'sha256',
      trimSubmission: normalizedConfig.trimSubmission,
      caseSensitive: normalizedConfig.caseSensitive,
      acceptedPrefixes: normalizedConfig.acceptedPrefixes,
    };
  }

  if (type === 'manual_review') {
    const normalizedConfig = normalizeManualReviewConfig({ ...config, type });
    return {
      type,
      minLength: normalizedConfig.minLength,
      maxLength: normalizedConfig.maxLength,
      submittedMessage: normalizedConfig.submittedMessage,
    };
  }

  if (type === 'aws_secret') {
    return { ...normalizeAwsSecretConfig({ ...config, type }) };
  }

  if (type === CIPHERED_SEAL_VALIDATOR_TYPE) {
    return { ...getCipheredSealConfig({ ...config, type }) };
  }

  getChallengeValidator(type);
  return {
    ...config,
    type,
  };
};

registerChallengeValidator(awsSecretValidator);
registerChallengeValidator(staticSecretValidator);
registerChallengeValidator(manualReviewValidator);
registerChallengeValidator(cipheredSealValidator);
