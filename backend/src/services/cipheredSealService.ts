import crypto from 'crypto';

import env from '../config/env';
import type { IChallengeDocument } from '../models/Challenge';
import type { IUserDocument } from '../models/User';

export const CIPHERED_SEAL_VALIDATOR_TYPE = 'ciphered_seal' as const;

export type CipheredSealWardCode = '200' | '301' | '403' | '500';

export interface CipheredSealValidationConfig {
  type: typeof CIPHERED_SEAL_VALIDATOR_TYPE;
  routeKey: string;
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  successMessage?: string;
}

export interface CipheredSealResolvedValues {
  r1: number;
  r2: number;
  leftSeal: 0 | 1;
  rightSeal: 0 | 1;
}

export interface CipheredSealWard {
  code: CipheredSealWardCode;
  name: 'Concord' | 'Choice' | 'Discord' | 'Mirror';
}

export interface CipheredSealPublicState {
  identifier: string;
  routeKey: string;
  layout: CipheredSealWard[];
}

const DEFAULT_ROUTE_KEY = '256027';
const DEFAULT_IMAGE_PATH = '/challenges/ciphered-seal/shrine-map.png';
const DEFAULT_IMAGE_WIDTH = 509;
const DEFAULT_IMAGE_HEIGHT = 503;
const MAX_SEED_NUMBER = 100000;

const WARDS: readonly CipheredSealWard[] = [
  { code: '200', name: 'Concord' },
  { code: '301', name: 'Choice' },
  { code: '403', name: 'Discord' },
  { code: '500', name: 'Mirror' },
];

const cleanString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const normalizeDimension = (value: unknown, fallback: number): number => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 && numericValue <= 4096
    ? numericValue
    : fallback;
};

export const normalizeCipheredSealConfig = (
  rawConfig: Record<string, unknown>
): CipheredSealValidationConfig => {
  if (rawConfig.type !== CIPHERED_SEAL_VALIDATOR_TYPE) {
    throw new Error('Invalid Ciphered Seal validator config type.');
  }

  const routeKey = cleanString(rawConfig.routeKey) || DEFAULT_ROUTE_KEY;
  if (!/^\d{4,12}$/.test(routeKey)) {
    throw new Error('Ciphered Seal routeKey must contain 4 to 12 digits.');
  }

  const imagePath = cleanString(rawConfig.imagePath) || DEFAULT_IMAGE_PATH;
  if (!imagePath.startsWith('/') || imagePath.includes('..')) {
    throw new Error('Ciphered Seal imagePath must be an absolute application path.');
  }

  const imageWidth = normalizeDimension(rawConfig.imageWidth, DEFAULT_IMAGE_WIDTH);
  const imageHeight = normalizeDimension(rawConfig.imageHeight, DEFAULT_IMAGE_HEIGHT);
  if (String(imageWidth * imageHeight) !== routeKey) {
    throw new Error('Ciphered Seal routeKey must equal imageWidth multiplied by imageHeight.');
  }

  return {
    type: CIPHERED_SEAL_VALIDATOR_TYPE,
    routeKey,
    imagePath,
    imageWidth,
    imageHeight,
    successMessage: cleanString(rawConfig.successMessage) || undefined,
  };
};

export const getCipheredSealIdentifier = (user: IUserDocument): string => {
  const identifier = cleanString(user.prizeversityShortId) || cleanString(user.username);
  if (!identifier) {
    throw new Error('A Prizeversity short ID or AWS Student Hub username is required.');
  }
  return identifier;
};

export const calculateCipheredSealSeed = (identifier: string): number => {
  let seed = 0;
  for (const character of identifier.normalize('NFKD').toUpperCase()) {
    if (character >= 'A' && character <= 'Z') {
      seed += character.charCodeAt(0) - 64;
    } else if (character >= '0' && character <= '9') {
      seed += Number(character);
    }
  }
  return seed;
};

export const resolveCipheredSealValues = (seedNumber: number): CipheredSealResolvedValues => {
  if (!Number.isInteger(seedNumber) || seedNumber < 0 || seedNumber > MAX_SEED_NUMBER) {
    throw new Error(`SeedNumber must be a whole number between 0 and ${MAX_SEED_NUMBER}.`);
  }

  const r1 = (seedNumber % 9) + 1;
  const r2 = (seedNumber % 7) + 3;
  return {
    r1,
    r2,
    leftSeal: (r1 % 2) as 0 | 1,
    rightSeal: (r2 % 2) as 0 | 1,
  };
};

const getSigningSecret = (): string => {
  const secret = env.CHALLENGE_SIGNING_SECRET || env.JWT_SECRET;
  if (!secret) {
    throw new Error('Challenge signing secret is not configured.');
  }
  return secret;
};

const getWardSortKey = (
  wardCode: CipheredSealWardCode,
  challenge: IChallengeDocument,
  user: IUserDocument
): string => {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(
      [
        'ciphered-seal-layout',
        String(challenge._id),
        String(challenge.version),
        String(user._id),
        wardCode,
      ].join(':')
    )
    .digest('hex');
};

export const buildCipheredSealLayout = (
  challenge: IChallengeDocument,
  user: IUserDocument
): CipheredSealWard[] => {
  return WARDS.map((ward) => ({ ...ward })).sort((left, right) =>
    getWardSortKey(left.code, challenge, user).localeCompare(
      getWardSortKey(right.code, challenge, user)
    )
  );
};

const getWardActivity = (
  code: CipheredSealWardCode,
  values: CipheredSealResolvedValues
): 0 | 1 => {
  const { leftSeal, rightSeal } = values;
  if (code === '200') return (leftSeal & rightSeal) as 0 | 1;
  if (code === '301') return (leftSeal | rightSeal) as 0 | 1;
  if (code === '403') return (leftSeal ^ rightSeal) as 0 | 1;
  return (leftSeal === 0 ? 1 : 0) as 0 | 1;
};

export const buildCipheredSealExpectedSequence = (
  challenge: IChallengeDocument,
  user: IUserDocument
): CipheredSealWardCode[] => {
  const identifier = getCipheredSealIdentifier(user);
  const values = resolveCipheredSealValues(calculateCipheredSealSeed(identifier));
  const layout = buildCipheredSealLayout(challenge, user);

  return [
    ...layout.filter((ward) => getWardActivity(ward.code, values) === 1),
    ...layout.filter((ward) => getWardActivity(ward.code, values) === 0),
  ].map((ward) => ward.code);
};

export const buildCipheredSealPublicState = (
  challenge: IChallengeDocument,
  user: IUserDocument
): CipheredSealPublicState => {
  const config = normalizeCipheredSealConfig(challenge.validation);
  return {
    identifier: getCipheredSealIdentifier(user),
    routeKey: config.routeKey,
    layout: buildCipheredSealLayout(challenge, user),
  };
};

export const resolveSubmittedCipheredSealSeed = (
  challenge: IChallengeDocument,
  user: IUserDocument,
  rawSeedNumber: unknown
): { resolved: boolean; message: string; values?: CipheredSealResolvedValues } => {
  const seedNumber = Number(rawSeedNumber);
  if (!Number.isInteger(seedNumber) || seedNumber < 0 || seedNumber > MAX_SEED_NUMBER) {
    return {
      resolved: false,
      message: `Enter a whole SeedNumber between 0 and ${MAX_SEED_NUMBER}.`,
    };
  }

  const expectedSeed = calculateCipheredSealSeed(getCipheredSealIdentifier(user));
  if (seedNumber !== expectedSeed) {
    return {
      resolved: false,
      message: 'The shrine did not recognize that SeedNumber. Revisit how the script orders symbols.',
    };
  }

  return {
    resolved: true,
    message: 'The two seals have resolved.',
    values: resolveCipheredSealValues(seedNumber),
  };
};

export const isCipheredSealSequence = (value: unknown): value is CipheredSealWardCode[] => {
  if (!Array.isArray(value) || value.length !== WARDS.length) return false;
  const submittedCodes = value.map((entry) => cleanString(entry));
  return (
    new Set(submittedCodes).size === WARDS.length &&
    submittedCodes.every((code) => WARDS.some((ward) => ward.code === code))
  );
};

export const compareCipheredSealSequence = (
  submitted: CipheredSealWardCode[],
  expected: CipheredSealWardCode[]
): boolean => {
  const submittedBuffer = Buffer.from(submitted.join(':'));
  const expectedBuffer = Buffer.from(expected.join(':'));
  return (
    submittedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(submittedBuffer, expectedBuffer)
  );
};

export const getCipheredSealPublicExperience = (
  rawConfig: Record<string, unknown>
): {
  type: typeof CIPHERED_SEAL_VALIDATOR_TYPE;
  imagePath: string;
} => {
  const config = normalizeCipheredSealConfig(rawConfig);
  return {
    type: CIPHERED_SEAL_VALIDATOR_TYPE,
    imagePath: config.imagePath,
  };
};

export const getCipheredSealSuccessMessage = (rawConfig: Record<string, unknown>): string => {
  return (
    normalizeCipheredSealConfig(rawConfig).successMessage ||
    'The shrine accepts the invocation sequence.'
  );
};
