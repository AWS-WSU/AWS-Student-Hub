export type ChallengeStatus = 'draft' | 'published' | 'archived';
export type ChallengeSource = 'curated' | 'custom';
export type ChallengeAssignmentStatus = 'draft' | 'published' | 'archived';
export type ChallengeKind = 'single' | 'multi_part';
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type ChallengeProgressStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'completed'
  | 'reward_pending'
  | 'reward_sent'
  | 'reward_failed';
export type ChallengeXpMode = 'none' | 'classroom' | 'custom';
export type ChallengeValidationType = 'aws_secret' | 'static_secret' | 'manual_review' | string;
export type ChallengeSubmissionStatus = 'accepted' | 'pending_review' | 'rejected' | 'error';

export interface ChallengeRewardPreview {
  enabled: boolean;
  bits: number;
  xpAmount?: number;
  xpMode?: ChallengeXpMode;
}

export interface CipheredSealExperience {
  type: 'ciphered_seal';
  imagePath: string;
}

export interface ChallengeRewardConfig extends ChallengeRewardPreview {
  activityName?: string;
  description?: string;
  stats?: {
    multiplier?: number;
    luck?: number;
    shield?: number;
    discount?: number;
  };
  applyGroupMultipliers?: boolean;
  applyPersonalMultipliers?: boolean;
}

export interface ChallengeProgress {
  id?: string;
  challengeId?: string;
  assignmentId?: string | null;
  rewardIntegrationInstanceId?: string | null;
  challengeKey?: string;
  challengeVersion?: number;
  status: ChallengeProgressStatus;
  attemptCount: number;
  startedAt?: string | null;
  lastSubmittedAt?: string | null;
  completedAt?: string | null;
  rewardEmissionId?: string | null;
  completionEventId?: string;
  lastValidationMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChallengeListItem {
  id: string;
  assignmentId?: string | null;
  key: string;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  instructions?: string;
  kind: ChallengeKind;
  difficulty: ChallengeDifficulty;
  estimatedMinutes?: number;
  tags: string[];
  version: number;
  validationType?: ChallengeValidationType;
  experience?: CipheredSealExperience;
  startsAt?: string | null;
  endsAt?: string | null;
  rewardIntegrationInstanceId?: string | null;
  reward: ChallengeRewardPreview;
  maxAttempts?: number;
  progress?: ChallengeProgress;
}

export interface ChallengeDetail extends ChallengeListItem {
  description: string;
  instructions?: string;
}

export interface ChallengeRewardLinkSummary {
  required: boolean;
  linked: boolean;
  configured: boolean;
  requiredInstanceId?: string | null;
  linkedInstanceId?: string | null;
}

export interface ChallengeListResponse {
  challenges: ChallengeListItem[];
  rewardLink: ChallengeRewardLinkSummary;
}

export interface ChallengeDetailResponse {
  challenge: ChallengeDetail;
  rewardLink: ChallengeRewardLinkSummary;
}

export interface ChallengeProgressResponse {
  challenge: ChallengeDetail;
  progress: ChallengeProgress;
}

export interface ChallengeSubmitResponse {
  accepted: boolean;
  completed: boolean;
  message: string;
  progress: ChallengeProgress;
  reward?: {
    status: 'not_required' | 'sent' | 'already_sent' | 'failed';
    emissionId?: string;
    message?: string;
  };
}

export type CipheredSealWardCode = '200' | '301' | '403' | '500';

export interface CipheredSealWard {
  code: CipheredSealWardCode;
  name: 'Concord' | 'Choice' | 'Discord' | 'Mirror';
}

export interface CipheredSealRouteStateResponse {
  challenge: ChallengeDetail;
  progress: ChallengeProgress;
  rewardLink: ChallengeRewardLinkSummary;
  protocol: {
    identifier: string;
    routeKey: string;
    layout: CipheredSealWard[];
  };
}

export interface CipheredSealResolveResponse {
  resolved: boolean;
  message: string;
  values?: {
    r1: number;
    r2: number;
    leftSeal: 0 | 1;
    rightSeal: 0 | 1;
  };
}

export interface AdminChallenge extends ChallengeDetail {
  source: ChallengeSource;
  status: ChallengeStatus;
  validation: Record<string, unknown>;
  reward: ChallengeRewardConfig;
  maxAttempts?: number;
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminChallengeListResponse {
  items: AdminChallenge[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminChallengeSubmission {
  id: string;
  userId: string;
  challengeId: string;
  assignmentId?: string | null;
  rewardIntegrationInstanceId?: string | null;
  progressId: string;
  challengeKey: string;
  validatorType: ChallengeValidationType;
  status: ChallengeSubmissionStatus;
  submittedPayloadPreview: Record<string, unknown>;
  validationResult: Record<string, unknown>;
  message?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminChallengeSubmissionsResponse {
  items: AdminChallengeSubmission[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminChallengeReviewResponse {
  message: string;
  submission: AdminChallengeSubmission;
  progress: ChallengeProgress;
  reward?: {
    status: 'not_required' | 'sent' | 'already_sent' | 'failed';
    emissionId?: string;
    message?: string;
  };
}

export interface AdminChallengePayload {
  key?: string;
  slug?: string;
  title: string;
  summary: string;
  description: string;
  instructions?: string;
  status?: ChallengeStatus;
  kind?: ChallengeKind;
  difficulty?: ChallengeDifficulty;
  estimatedMinutes?: number;
  tags?: string[];
  maxAttempts?: number;
  validation: Record<string, unknown>;
  reward?: Partial<ChallengeRewardConfig>;
}

export interface AdminChallengeResponse {
  message?: string;
  challenge: AdminChallenge;
}

export interface AdminChallengeDeleteResponse {
  message?: string;
  deleted: true;
  challengeId: string;
  progressDeleted: number;
  submissionsDeleted: number;
}

export interface AdminChallengeAssignmentProgress {
  total: number;
  completed: number;
  pendingReview: number;
}

export interface AdminChallengeAssignment {
  id: string;
  challengeId: string;
  rewardIntegrationInstanceId: string;
  challengeVersion: number;
  status: ChallengeAssignmentStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  maxAttempts?: number;
  reward: ChallengeRewardConfig;
  publishedAt?: string | null;
  archivedAt?: string | null;
  assignedBy: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  progress: AdminChallengeAssignmentProgress;
  challenge: AdminChallenge;
}

export interface AdminChallengeAssignmentPayload {
  challengeId?: string;
  status?: ChallengeAssignmentStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  maxAttempts?: number | null;
  reward?: Partial<ChallengeRewardConfig>;
}

export interface AdminChallengeAssignmentsResponse {
  items: AdminChallengeAssignment[];
}

export interface AdminChallengeAssignmentResponse {
  message: string;
  assignment: AdminChallengeAssignment;
}

export interface AdminChallengeAssignmentRemoveResponse {
  message: string;
  removed: boolean;
  archived: boolean;
  assignmentId: string;
  progressCount: number;
}
