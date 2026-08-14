import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

import { challengeRewardSchema, IChallengeRewardConfig } from './Challenge';

export type ChallengeAssignmentStatus = 'draft' | 'published' | 'archived';

export interface IChallengeAssignment {
  challengeId: Types.ObjectId;
  rewardIntegrationInstanceId: Types.ObjectId;
  challengeVersion: number;
  status: ChallengeAssignmentStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxAttempts?: number;
  hint?: string;
  reward: IChallengeRewardConfig;
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  assignedBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IChallengeAssignmentDocument = HydratedDocument<IChallengeAssignment>;
type ChallengeAssignmentModel = Model<IChallengeAssignment>;

const challengeAssignmentSchema = new Schema<IChallengeAssignment, ChallengeAssignmentModel>(
  {
    challengeId: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
      required: true,
      index: true,
    },
    rewardIntegrationInstanceId: {
      type: Schema.Types.ObjectId,
      ref: 'RewardIntegrationInstance',
      required: true,
      index: true,
    },
    challengeVersion: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    maxAttempts: {
      type: Number,
      min: 1,
    },
    hint: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    reward: {
      type: challengeRewardSchema,
      default: () => ({ enabled: false, bits: 0 }),
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

challengeAssignmentSchema.index(
  { challengeId: 1, rewardIntegrationInstanceId: 1 },
  { unique: true }
);
challengeAssignmentSchema.index({
  rewardIntegrationInstanceId: 1,
  status: 1,
  startsAt: 1,
  endsAt: 1,
});

const ChallengeAssignment = mongoose.model<IChallengeAssignment, ChallengeAssignmentModel>(
  'ChallengeAssignment',
  challengeAssignmentSchema
);

export default ChallengeAssignment;
