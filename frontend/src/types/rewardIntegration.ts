import type { User } from './user';

export interface LinkedRewardAccount {
  instanceId?: string;
  userId: string;
  classroomId: string;
  email?: string;
  matchedName?: string;
  shortId?: string;
  linkedAt?: string;
  lastSyncedAt?: string;
}

export interface RewardIntegrationInstance {
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
  lastVerifiedAt?: string | null;
  lastVerificationStatus?: string;
  lastVerificationError?: string;
  lastUserCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RewardIntegrationStatusResponse {
  configured: boolean;
  linked: boolean;
  missingConfig: string[];
  account: LinkedRewardAccount | null;
  instances: RewardIntegrationInstance[];
}

export interface RewardIntegrationLinkResponse {
  message: string;
  status: RewardIntegrationStatusResponse;
  user: User;
  verificationRequired?: boolean;
  maskedEmail?: string;
  expiresAt?: string;
}

export interface RewardIntegrationInstancePayload {
  name: string;
  description?: string;
  apiBaseUrl: string;
  apiKey?: string;
  classroomId: string;
  classroomName?: string;
  scopes?: string[];
  active?: boolean;
}

export interface RewardIntegrationClassroomMember {
  userId: string;
  shortId?: string;
  name: string;
  email?: string;
  role: string;
  balance: number;
  level: number;
  xp: number;
  joinedDate?: string | null;
  lastAccessed?: string | null;
  linkedAwsAccount: boolean;
  awsUserId?: string;
}

export interface RewardIntegrationClassroomMembersResponse {
  classroomId: string;
  classroomName?: string;
  users: RewardIntegrationClassroomMember[];
}
