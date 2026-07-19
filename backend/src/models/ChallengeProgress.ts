import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

export type ChallengeProgressStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'completed'
  | 'reward_pending'
  | 'reward_sent'
  | 'reward_failed';

export interface IChallengeProgress {
  userId: Types.ObjectId;
  challengeId: Types.ObjectId;
  assignmentId?: Types.ObjectId | null;
  rewardIntegrationInstanceId?: Types.ObjectId | null;
  challengeKey: string;
  challengeVersion: number;
  status: ChallengeProgressStatus;
  attemptCount: number;
  startedAt?: Date | null;
  lastSubmittedAt?: Date | null;
  completedAt?: Date | null;
  rewardEmissionId?: Types.ObjectId | null;
  completionEventId?: string;
  lastValidationMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type IChallengeProgressDocument = HydratedDocument<IChallengeProgress>;
type ChallengeProgressModel = Model<IChallengeProgress>;

const challengeProgressSchema = new Schema<IChallengeProgress, ChallengeProgressModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    challengeId: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
      required: true,
      index: true,
    },
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'ChallengeAssignment',
      default: null,
      index: true,
    },
    rewardIntegrationInstanceId: {
      type: Schema.Types.ObjectId,
      ref: 'RewardIntegrationInstance',
      default: null,
      index: true,
    },
    challengeKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    challengeVersion: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: [
        'not_started',
        'in_progress',
        'pending_review',
        'completed',
        'reward_pending',
        'reward_sent',
        'reward_failed',
      ],
      default: 'not_started',
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    lastSubmittedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    rewardEmissionId: {
      type: Schema.Types.ObjectId,
      ref: 'RewardIntegrationEmission',
      default: null,
    },
    completionEventId: {
      type: String,
      trim: true,
    },
    lastValidationMessage: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

challengeProgressSchema.index(
  { userId: 1, assignmentId: 1 },
  {
    unique: true,
    partialFilterExpression: { assignmentId: { $type: 'objectId' } },
  }
);
challengeProgressSchema.index({ userId: 1, status: 1 });
challengeProgressSchema.index({ completionEventId: 1 }, { unique: true, sparse: true });

const ChallengeProgress = mongoose.model<IChallengeProgress, ChallengeProgressModel>(
  'ChallengeProgress',
  challengeProgressSchema
);

export default ChallengeProgress;
