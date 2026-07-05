export type ChallengeStatus = 'draft' | 'published' | 'archived';
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
  startsAt?: string | null;
  endsAt?: string | null;
  reward: ChallengeRewardPreview;
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

export interface AdminChallenge extends ChallengeDetail {
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
