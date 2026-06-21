import crypto from 'crypto';
import { Types } from 'mongoose';

import env from '../config/env';
import logger from '../config/logger';
import RewardIntegrationEmission from '../models/RewardIntegrationEmission';
import RewardIntegrationLinkVerification from '../models/RewardIntegrationLinkVerification';
import RewardIntegrationInstance, {
  IRewardIntegrationInstanceDocument,
} from '../models/RewardIntegrationInstance';
import type { IUserDocument } from '../models/User';
import { sendPrizeversityLinkCode } from './emailService';

const log = logger.child({ module: 'reward-integration-service' });

const REQUEST_TIMEOUT_MS = 12000;
const LINK_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_LINK_CODE_ATTEMPTS = 5;
const DEFAULT_PROVIDER = 'prizeversity';
const DEFAULT_API_BASE_URL = 'https://www.prizeversity.com';
const DEFAULT_SCOPES = ['users:read', 'users:match', 'reward:grant'];

export interface PublicRewardIntegrationInstance {
  id: string;
  source: 'database' | 'environment';
  provider: 'prizeversity';
  name: string;
  description?: string;
  apiBaseUrl: string;
  apiKeyPreview?: string;
  classroomId: string;
  classroomName?: string;
  scopes: string[];
  active: boolean;
  lastVerifiedAt?: Date | null;
  lastVerificationStatus?: string;
  lastVerificationError?: string;
  lastUserCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RewardIntegrationConfig extends PublicRewardIntegrationInstance {
  apiKey: string;
}

export interface RewardIntegrationInstanceInput {
  name?: string;
  description?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  classroomId?: string;
  classroomName?: string;
  scopes?: string[];
  active?: boolean;
}

export interface RewardIntegrationTestResult {
  classroomId: string;
  classroomName?: string;
  userCount: number;
  verifiedAt: Date;
}

export interface PrizeversityLinkedAccount {
  instanceId?: string;
  userId: string;
  classroomId: string;
  email?: string;
  matchedName?: string;
  shortId?: string;
  linkedAt?: Date | null;
  lastSyncedAt?: Date | null;
}

export interface PrizeversityStatus {
  configured: boolean;
  linked: boolean;
  missingConfig: string[];
  account: PrizeversityLinkedAccount | null;
  instances: PublicRewardIntegrationInstance[];
}

export interface PrizeversityLinkVerificationStart {
  verificationRequired: true;
  maskedEmail: string;
  expiresAt: Date;
}

interface PrizeversityUserListResponse {
  classroomId: string;
  className?: string;
  users?: PrizeversityClassroomUser[];
}

interface PrizeversityClassroomUser {
  userId: string;
  shortId?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

interface PrizeversityUsersMatchResponse {
  matched?: PrizeversityMatchedUser[];
  unmatched?: Array<Record<string, unknown>>;
  total?: number;
}

interface PrizeversityMatchedUser {
  userId: string;
  matchedName?: string;
  email?: string;
  name?: string;
  shortId?: string;
  [key: string]: unknown;
}

export interface PrizeversityRewardRequest {
  awsUserId: string | Types.ObjectId;
  prizeversityUserId: string;
  rewardIntegrationInstanceId?: string;
  classroomId?: string;
  challengeKey: string;
  activityName: string;
  description?: string;
  bits?: number;
  stats?: {
    multiplier?: number;
    luck?: number;
    discount?: number;
    shield?: number;
  };
  completionXP?: {
    mode?: 'none' | 'classroom' | 'custom';
    xpAmount?: number;
  };
  applyGroupMultipliers?: boolean;
  applyPersonalMultipliers?: boolean;
}

export interface PrizeversityRewardResult {
  alreadySent: boolean;
  emissionId?: string;
  response: Record<string, unknown> | null;
}

class PrizeversityError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PrizeversityError';
    this.status = status;
  }
}

const cleanPastedValue = (value?: string | null): string => {
  return (value || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
};

const getApiKeyPreview = (apiKey: string): string => {
  const trimmed = cleanPastedValue(apiKey);
  if (trimmed.length <= 12) return 'provided';
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
};

const normalizeBaseUrl = (value?: string): string => {
  const rawValue = cleanPastedValue(
    value || env.PRIZEVERSITY_API_URL || DEFAULT_API_BASE_URL
  ).replace(/\/+$/, '');

  try {
    const url = new URL(rawValue);
    url.pathname = url.pathname.replace(/\/api\/integrations(?:\/.*)?$/i, '').replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return rawValue.replace(/\/api\/integrations(?:\/.*)?$/i, '').replace(/\/+$/, '');
  }
};

const normalizeScopes = (scopes?: string[]): string[] => {
  const normalized = (scopes || []).map(cleanPastedValue).filter(Boolean);
  return normalized.length ? normalized : DEFAULT_SCOPES;
};

const generateLinkCode = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

const hashLinkCode = (code: string, salt: string): string => {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
};

const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${'*'.repeat(Math.max(localPart.length - visible.length, 3))}@${domain}`;
};

export const getPrizeversityMissingConfig = (): string[] => {
  const missing: string[] = [];
  if (!env.PRIZEVERSITY_API_URL) missing.push('PRIZEVERSITY_API_URL');
  if (!env.PRIZEVERSITY_API_KEY) missing.push('PRIZEVERSITY_API_KEY');
  if (!env.PRIZEVERSITY_CLASSROOM_ID) missing.push('PRIZEVERSITY_CLASSROOM_ID');
  return missing;
};

export const isPrizeversityConfigured = (): boolean => getPrizeversityMissingConfig().length === 0;

const normalize = (value?: string | null): string => (value || '').trim().toLowerCase();

const uniqueStrings = (values: Array<string | undefined | null>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const trimmed = value?.trim();
    const key = normalize(trimmed);
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  });

  return result;
};

const getUserDisplayName = (user: IUserDocument): string => {
  return user.fullName || user.username || user.email;
};

const getCandidateIdentifiers = (user: IUserDocument, identifier?: string): string[] => {
  return uniqueStrings([identifier, user.email, user.fullName, user.username]);
};

const getEnvironmentInstance = (): RewardIntegrationConfig | null => {
  if (!isPrizeversityConfigured()) return null;

  const apiKey = cleanPastedValue(env.PRIZEVERSITY_API_KEY);
  const classroomId = cleanPastedValue(env.PRIZEVERSITY_CLASSROOM_ID);

  return {
    id: 'env',
    source: 'environment',
    provider: DEFAULT_PROVIDER,
    name: 'Default Prizeversity Classroom',
    description: 'Configured from backend environment variables.',
    apiBaseUrl: normalizeBaseUrl(env.PRIZEVERSITY_API_URL),
    apiKey,
    apiKeyPreview: getApiKeyPreview(apiKey),
    classroomId,
    classroomName: '',
    scopes: DEFAULT_SCOPES,
    active: true,
    lastVerificationStatus: 'untested',
  };
};

const toPublicInstance = (
  instance: IRewardIntegrationInstanceDocument
): PublicRewardIntegrationInstance => {
  return {
    id: String(instance._id),
    source: 'database',
    provider: instance.provider,
    name: instance.name,
    description: instance.description,
    apiBaseUrl: instance.apiBaseUrl,
    apiKeyPreview: instance.apiKeyPreview,
    classroomId: instance.classroomId,
    classroomName: instance.classroomName,
    scopes: instance.scopes || [],
    active: instance.active,
    lastVerifiedAt: instance.lastVerifiedAt,
    lastVerificationStatus: instance.lastVerificationStatus,
    lastVerificationError: instance.lastVerificationError,
    lastUserCount: instance.lastUserCount,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
  };
};

const toConfig = (instance: IRewardIntegrationInstanceDocument): RewardIntegrationConfig => {
  return {
    ...toPublicInstance(instance),
    apiKey: instance.apiKey,
  };
};

const prizeversityRequest = async <T>(
  config: Pick<RewardIntegrationConfig, 'apiBaseUrl' | 'apiKey'>,
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalizeBaseUrl(config.apiBaseUrl)}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        ...(options.headers || {}),
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? ((await response.json()) as Record<string, unknown>)
      : ({ message: await response.text() } as Record<string, unknown>);

    if (!response.ok) {
      const message =
        typeof data.error === 'string'
          ? data.error
          : typeof data.message === 'string'
            ? data.message
            : `Prizeversity request failed with status ${response.status}`;
      throw new PrizeversityError(message, response.status);
    }

    return data as T;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new PrizeversityError('Prizeversity request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const usersMatch = async (
  config: RewardIntegrationConfig,
  identifiers: string[],
  user: IUserDocument
): Promise<PrizeversityMatchedUser | null> => {
  const response = await prizeversityRequest<PrizeversityUsersMatchResponse>(
    config,
    '/api/integrations/users/match',
    {
      method: 'POST',
      body: JSON.stringify({
        classroomId: config.classroomId,
        users: identifiers.map((identifier, index) => ({
          name: identifier,
          email: user.email,
          awsUserId: String(user._id),
          candidateIndex: index,
        })),
      }),
    }
  );

  return response.matched?.[0] || null;
};

const usersList = async (
  config: RewardIntegrationConfig
): Promise<PrizeversityUserListResponse> => {
  const classroomId = encodeURIComponent(cleanPastedValue(config.classroomId));

  return prizeversityRequest<PrizeversityUserListResponse>(
    config,
    `/api/integrations/users/list/${classroomId}?fields=extended`
  );
};

const findExactUser = (
  users: PrizeversityClassroomUser[],
  identifiers: string[]
): PrizeversityClassroomUser | null => {
  const normalizedIdentifiers = identifiers.map(normalize);

  return (
    users.find((candidate) => {
      const fullName =
        candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
      const searchableValues = [candidate.userId, candidate.shortId, candidate.email, fullName].map(
        normalize
      );

      return searchableValues.some((value) => value && normalizedIdentifiers.includes(value));
    }) || null
  );
};

const toLinkedAccount = (
  user: PrizeversityClassroomUser | PrizeversityMatchedUser,
  config: RewardIntegrationConfig
): PrizeversityLinkedAccount => {
  return {
    instanceId: config.id,
    userId: String(user.userId),
    classroomId: config.classroomId,
    email: user.email,
    matchedName:
      'matchedName' in user && typeof user.matchedName === 'string' ? user.matchedName : user.name,
    shortId: user.shortId,
  };
};

export const listRewardIntegrationInstances = async (): Promise<
  PublicRewardIntegrationInstance[]
> => {
  const instances = await RewardIntegrationInstance.find().sort({ createdAt: -1 });
  return instances.map(toPublicInstance);
};

export const listActiveRewardIntegrationInstances = async (): Promise<
  PublicRewardIntegrationInstance[]
> => {
  const instances = await RewardIntegrationInstance.find({ active: true }).sort({ createdAt: 1 });
  const publicInstances = instances.map(toPublicInstance);

  if (publicInstances.length === 0) {
    const envInstance = getEnvironmentInstance();
    if (envInstance) {
      const { apiKey: _apiKey, ...publicEnvInstance } = envInstance;
      publicInstances.push(publicEnvInstance);
    }
  }

  return publicInstances;
};

const getInstanceConfigById = async (
  instanceId?: string
): Promise<RewardIntegrationConfig | null> => {
  if (instanceId === 'env') {
    return getEnvironmentInstance();
  }

  if (instanceId) {
    if (!Types.ObjectId.isValid(instanceId)) return null;
    const instance = await RewardIntegrationInstance.findOne({
      _id: instanceId,
      active: true,
    }).select('+apiKey');
    return instance ? toConfig(instance) : null;
  }

  const instance = await RewardIntegrationInstance.findOne({ active: true })
    .sort({ createdAt: 1 })
    .select('+apiKey');

  if (instance) return toConfig(instance);
  return getEnvironmentInstance();
};

const getInstanceConfigForClassroom = async (
  classroomId?: string,
  instanceId?: string
): Promise<RewardIntegrationConfig | null> => {
  const explicitInstance = await getInstanceConfigById(instanceId);
  if (explicitInstance) return explicitInstance;

  if (classroomId) {
    const instance = await RewardIntegrationInstance.findOne({
      classroomId,
      active: true,
    }).select('+apiKey');
    if (instance) return toConfig(instance);

    const envInstance = getEnvironmentInstance();
    if (envInstance?.classroomId === classroomId) return envInstance;
  }

  return getInstanceConfigById();
};

export const getPrizeversityStatus = async (
  user: IUserDocument | null
): Promise<PrizeversityStatus> => {
  const instances = await listActiveRewardIntegrationInstances();
  const missingConfig = instances.length > 0 ? [] : getPrizeversityMissingConfig();
  const account =
    user?.prizeversityUserId && user.prizeversityClassroomId
      ? {
          instanceId:
            user.rewardIntegrationInstanceId?.toString() ||
            instances.find((instance) => instance.classroomId === user.prizeversityClassroomId)?.id,
          userId: user.prizeversityUserId,
          classroomId: user.prizeversityClassroomId,
          email: user.prizeversityEmail,
          matchedName: user.prizeversityMatchedName,
          shortId: user.prizeversityShortId,
          linkedAt: user.prizeversityLinkedAt,
          lastSyncedAt: user.prizeversityLastSyncedAt,
        }
      : null;

  return {
    configured: instances.length > 0,
    linked: Boolean(account),
    missingConfig,
    account,
    instances,
  };
};

export const testRewardIntegrationConfig = async (
  config: RewardIntegrationConfig
): Promise<RewardIntegrationTestResult> => {
  const response = await usersList(config);
  const verifiedAt = new Date();

  return {
    classroomId: response.classroomId || config.classroomId,
    classroomName: response.className,
    userCount: response.users?.length || 0,
    verifiedAt,
  };
};

export const createRewardIntegrationInstance = async (
  input: RewardIntegrationInstanceInput,
  adminUserId: string
): Promise<PublicRewardIntegrationInstance> => {
  const name = cleanPastedValue(input.name);
  const apiKey = cleanPastedValue(input.apiKey);
  const classroomId = cleanPastedValue(input.classroomId);

  if (!name) throw new PrizeversityError('Instance name is required.');
  if (!apiKey) throw new PrizeversityError('Prizeversity API key is required.');
  if (!classroomId) throw new PrizeversityError('Prizeversity classroom ID is required.');

  const apiBaseUrl = normalizeBaseUrl(input.apiBaseUrl);
  const config: RewardIntegrationConfig = {
    id: 'new',
    source: 'database',
    provider: DEFAULT_PROVIDER,
    name,
    description: cleanPastedValue(input.description),
    apiBaseUrl,
    apiKey,
    apiKeyPreview: getApiKeyPreview(apiKey),
    classroomId,
    classroomName: cleanPastedValue(input.classroomName),
    scopes: normalizeScopes(input.scopes),
    active: input.active ?? true,
  };

  const testResult = await testRewardIntegrationConfig(config);

  const instance = await RewardIntegrationInstance.create({
    name,
    description: config.description,
    provider: DEFAULT_PROVIDER,
    apiBaseUrl,
    apiKey,
    apiKeyPreview: config.apiKeyPreview,
    classroomId,
    classroomName: testResult.classroomName || config.classroomName,
    scopes: config.scopes,
    active: config.active,
    lastVerifiedAt: testResult.verifiedAt,
    lastVerificationStatus: 'verified',
    lastVerificationError: undefined,
    lastUserCount: testResult.userCount,
    createdBy: new Types.ObjectId(adminUserId),
  });

  return toPublicInstance(instance);
};

export const updateRewardIntegrationInstance = async (
  instanceId: string,
  input: RewardIntegrationInstanceInput,
  adminUserId: string
): Promise<PublicRewardIntegrationInstance> => {
  if (!Types.ObjectId.isValid(instanceId)) {
    throw new PrizeversityError('Invalid integration instance ID.');
  }

  const instance = await RewardIntegrationInstance.findById(instanceId).select('+apiKey');
  if (!instance) throw new PrizeversityError('Integration instance not found.');

  const nextApiBaseUrl = input.apiBaseUrl
    ? normalizeBaseUrl(input.apiBaseUrl)
    : instance.apiBaseUrl;
  const nextApiKey = cleanPastedValue(input.apiKey) || instance.apiKey;
  const nextClassroomId = cleanPastedValue(input.classroomId) || instance.classroomId;
  const shouldRetest =
    nextApiBaseUrl !== instance.apiBaseUrl ||
    nextApiKey !== instance.apiKey ||
    nextClassroomId !== instance.classroomId;

  if (input.name !== undefined) instance.name = cleanPastedValue(input.name);
  if (input.description !== undefined) instance.description = cleanPastedValue(input.description);
  if (input.apiBaseUrl !== undefined) instance.apiBaseUrl = nextApiBaseUrl;
  if (input.apiKey !== undefined && cleanPastedValue(input.apiKey)) {
    instance.apiKey = nextApiKey;
    instance.apiKeyPreview = getApiKeyPreview(nextApiKey);
  }
  if (input.classroomId !== undefined) instance.classroomId = nextClassroomId;
  if (input.classroomName !== undefined)
    instance.classroomName = cleanPastedValue(input.classroomName);
  if (input.scopes !== undefined) instance.scopes = normalizeScopes(input.scopes);
  if (input.active !== undefined) instance.active = input.active;
  instance.updatedBy = new Types.ObjectId(adminUserId);

  if (shouldRetest) {
    const testResult = await testRewardIntegrationConfig({
      ...toConfig(instance),
      apiBaseUrl: nextApiBaseUrl,
      apiKey: nextApiKey,
      classroomId: nextClassroomId,
    });
    instance.classroomName = testResult.classroomName || instance.classroomName;
    instance.lastVerifiedAt = testResult.verifiedAt;
    instance.lastVerificationStatus = 'verified';
    instance.lastVerificationError = undefined;
    instance.lastUserCount = testResult.userCount;
  }

  await instance.save();
  return toPublicInstance(instance);
};

export const testRewardIntegrationInstance = async (
  instanceId: string,
  adminUserId: string
): Promise<{ instance: PublicRewardIntegrationInstance; test: RewardIntegrationTestResult }> => {
  if (!Types.ObjectId.isValid(instanceId)) {
    throw new PrizeversityError('Invalid integration instance ID.');
  }

  const instance = await RewardIntegrationInstance.findById(instanceId).select('+apiKey');
  if (!instance) throw new PrizeversityError('Integration instance not found.');

  try {
    const test = await testRewardIntegrationConfig(toConfig(instance));
    instance.classroomName = test.classroomName || instance.classroomName;
    instance.lastVerifiedAt = test.verifiedAt;
    instance.lastVerificationStatus = 'verified';
    instance.lastVerificationError = undefined;
    instance.lastUserCount = test.userCount;
    instance.updatedBy = new Types.ObjectId(adminUserId);
    await instance.save();

    return { instance: toPublicInstance(instance), test };
  } catch (error: unknown) {
    instance.lastVerifiedAt = new Date();
    instance.lastVerificationStatus = 'failed';
    instance.lastVerificationError =
      error instanceof Error ? error.message : 'Integration test failed.';
    instance.updatedBy = new Types.ObjectId(adminUserId);
    await instance.save();
    throw error;
  }
};

export const deactivateRewardIntegrationInstance = async (
  instanceId: string,
  adminUserId: string
): Promise<PublicRewardIntegrationInstance> => {
  return updateRewardIntegrationInstance(instanceId, { active: false }, adminUserId);
};

const resolvePrizeversityAccount = async (
  user: IUserDocument,
  options: { identifier?: string; instanceId?: string } = {}
): Promise<{ config: RewardIntegrationConfig; matchedAccount: PrizeversityLinkedAccount }> => {
  const config = await getInstanceConfigById(options.instanceId);
  if (!config) {
    throw new PrizeversityError('No active Prizeversity reward integration is configured.');
  }

  const identifiers = getCandidateIdentifiers(user, options.identifier);
  let matchedAccount: PrizeversityLinkedAccount | null = null;

  try {
    const classroomUsers = await usersList(config);
    const exactUser = findExactUser(classroomUsers.users || [], identifiers);
    if (exactUser) {
      matchedAccount = toLinkedAccount(exactUser, config);
    }
  } catch (error: unknown) {
    log.warn('prizeversity users/list lookup failed; falling back to users/match.', {
      error: error instanceof Error ? error.message : error,
      userId: String(user._id),
      instanceId: config.id,
    });
  }

  if (!matchedAccount) {
    const matchedUser = await usersMatch(config, identifiers, user);
    if (matchedUser) {
      matchedAccount = toLinkedAccount(matchedUser, config);
    }
  }

  if (!matchedAccount) {
    throw new PrizeversityError(
      `No Prizeversity classroom member matched ${options.identifier || getUserDisplayName(user)}.`
    );
  }

  return { config, matchedAccount };
};

const applyPrizeversityLink = async (
  user: IUserDocument,
  matchedAccount: PrizeversityLinkedAccount,
  rewardIntegrationInstanceId?: Types.ObjectId | null
): Promise<PrizeversityLinkedAccount> => {
  const now = new Date();
  user.rewardIntegrationInstanceId = rewardIntegrationInstanceId || null;
  user.prizeversityUserId = matchedAccount.userId;
  user.prizeversityClassroomId = matchedAccount.classroomId;
  user.prizeversityEmail = matchedAccount.email;
  user.prizeversityMatchedName = matchedAccount.matchedName;
  user.prizeversityShortId = matchedAccount.shortId;
  user.prizeversityLinkedAt = user.prizeversityLinkedAt || now;
  user.prizeversityLastSyncedAt = now;
  await user.save();

  return {
    ...matchedAccount,
    linkedAt: user.prizeversityLinkedAt,
    lastSyncedAt: user.prizeversityLastSyncedAt,
  };
};

export const startPrizeversityAccountLink = async (
  user: IUserDocument,
  options: { identifier?: string; instanceId?: string } = {}
): Promise<PrizeversityLinkVerificationStart> => {
  const { config, matchedAccount } = await resolvePrizeversityAccount(user, options);
  const email = cleanPastedValue(matchedAccount.email).toLowerCase();

  if (!email) {
    throw new PrizeversityError(
      'Matched Prizeversity account does not have an email address. Ask an admin to link your account.'
    );
  }

  const code = generateLinkCode();
  const codeSalt = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
  const rewardIntegrationInstanceId =
    config.source === 'database' ? new Types.ObjectId(config.id) : null;

  await RewardIntegrationLinkVerification.findOneAndUpdate(
    { awsUserId: user._id },
    {
      awsUserId: user._id,
      rewardIntegrationInstanceId,
      prizeversityUserId: matchedAccount.userId,
      classroomId: matchedAccount.classroomId,
      email,
      matchedName: matchedAccount.matchedName,
      shortId: matchedAccount.shortId,
      codeHash: hashLinkCode(code, codeSalt),
      codeSalt,
      attempts: 0,
      expiresAt,
    },
    { new: true, setDefaultsOnInsert: true, upsert: true }
  );

  try {
    await sendPrizeversityLinkCode(
      email,
      code,
      matchedAccount.matchedName || user.fullName || 'there',
      config.classroomName || config.name
    );
  } catch (error: unknown) {
    await RewardIntegrationLinkVerification.deleteOne({ awsUserId: user._id });
    log.error('failed to send prizeversity link verification code.', {
      error: error instanceof Error ? error.message : error,
      userId: String(user._id),
      instanceId: config.id,
    });
    throw new PrizeversityError(
      'Prizeversity match found, but AWS Student Hub could not send the verification email. Ask an admin to check SMTP credentials.',
      503
    );
  }

  return {
    verificationRequired: true,
    maskedEmail: maskEmail(email),
    expiresAt,
  };
};

export const verifyPrizeversityAccountLink = async (
  user: IUserDocument,
  code: string
): Promise<PrizeversityLinkedAccount> => {
  const cleanedCode = cleanPastedValue(code);
  if (!cleanedCode) throw new PrizeversityError('Verification code is required.');

  const pending = await RewardIntegrationLinkVerification.findOne({ awsUserId: user._id });
  if (!pending) {
    throw new PrizeversityError('No Prizeversity link code is pending. Request a new code.');
  }

  if (pending.expiresAt.getTime() <= Date.now()) {
    await pending.deleteOne();
    throw new PrizeversityError('Prizeversity link code expired. Request a new code.');
  }

  if (pending.attempts >= MAX_LINK_CODE_ATTEMPTS) {
    await pending.deleteOne();
    throw new PrizeversityError('Too many incorrect codes. Request a new code.');
  }

  const expectedHash = hashLinkCode(cleanedCode, pending.codeSalt);
  if (expectedHash !== pending.codeHash) {
    pending.attempts += 1;
    await pending.save();
    throw new PrizeversityError('Invalid Prizeversity link code.');
  }

  const account = await applyPrizeversityLink(
    user,
    {
      userId: pending.prizeversityUserId,
      classroomId: pending.classroomId,
      email: pending.email,
      matchedName: pending.matchedName,
      shortId: pending.shortId,
    },
    pending.rewardIntegrationInstanceId || null
  );

  await pending.deleteOne();
  return account;
};

export const linkPrizeversityAccount = async (
  user: IUserDocument,
  options: { identifier?: string; instanceId?: string } = {}
): Promise<PrizeversityLinkedAccount> => {
  const { config, matchedAccount } = await resolvePrizeversityAccount(user, options);
  const rewardIntegrationInstanceId =
    config.source === 'database' ? new Types.ObjectId(config.id) : null;
  return applyPrizeversityLink(user, matchedAccount, rewardIntegrationInstanceId);
};

export const unlinkPrizeversityAccount = async (user: IUserDocument): Promise<void> => {
  await RewardIntegrationLinkVerification.deleteOne({ awsUserId: user._id });
  user.rewardIntegrationInstanceId = null;
  user.prizeversityUserId = undefined;
  user.prizeversityClassroomId = undefined;
  user.prizeversityEmail = undefined;
  user.prizeversityMatchedName = undefined;
  user.prizeversityShortId = undefined;
  user.prizeversityLinkedAt = null;
  user.prizeversityLastSyncedAt = null;
  await user.save();
};

export const grantPrizeversityChallengeReward = async ({
  awsUserId,
  prizeversityUserId,
  rewardIntegrationInstanceId,
  classroomId,
  challengeKey,
  activityName,
  description = '',
  bits = 0,
  stats = {},
  completionXP = { mode: 'classroom' },
  applyGroupMultipliers = true,
  applyPersonalMultipliers = true,
}: PrizeversityRewardRequest): Promise<PrizeversityRewardResult> => {
  const config = await getInstanceConfigForClassroom(classroomId, rewardIntegrationInstanceId);
  if (!config) {
    throw new PrizeversityError('No active Prizeversity reward integration is configured.');
  }

  const awsUserObjectId = new Types.ObjectId(String(awsUserId));
  const requestPayload = {
    classroomId: config.classroomId,
    userId: prizeversityUserId,
    activityName,
    description,
    bits,
    stats,
    completionXP,
    applyGroupMultipliers,
    applyPersonalMultipliers,
  };

  const existing = await RewardIntegrationEmission.findOne({
    awsUserId: awsUserObjectId,
    classroomId: config.classroomId,
    challengeKey,
  });

  if (existing?.status === 'sent') {
    return {
      alreadySent: true,
      emissionId: existing._id.toString(),
      response: (existing.responsePayload as Record<string, unknown>) || null,
    };
  }

  const emission =
    existing ||
    (await RewardIntegrationEmission.create({
      awsUserId: awsUserObjectId,
      prizeversityUserId,
      classroomId: config.classroomId,
      challengeKey,
      activityName,
      status: 'pending',
      requestPayload,
    }));

  try {
    const response = await prizeversityRequest<Record<string, unknown>>(
      config,
      '/api/integrations/reward',
      {
        method: 'POST',
        body: JSON.stringify(requestPayload),
      }
    );

    emission.status = 'sent';
    emission.responsePayload = response;
    emission.errorMessage = undefined;
    emission.sentAt = new Date();
    await emission.save();

    return {
      alreadySent: false,
      emissionId: emission._id.toString(),
      response,
    };
  } catch (error: unknown) {
    emission.status = 'failed';
    emission.errorMessage = error instanceof Error ? error.message : 'Prizeversity reward failed';
    await emission.save();
    throw error;
  }
};
