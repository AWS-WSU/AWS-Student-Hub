import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

export type RewardIntegrationProvider = 'prizeversity';
export type RewardIntegrationVerificationStatus = 'untested' | 'verified' | 'failed';

export interface IRewardIntegrationInstance {
  name: string;
  description?: string;
  provider: RewardIntegrationProvider;
  apiBaseUrl: string;
  apiKey: string;
  apiKeyPreview: string;
  classroomId: string;
  classroomName?: string;
  scopes: string[];
  active: boolean;
  lastVerifiedAt?: Date | null;
  lastVerificationStatus: RewardIntegrationVerificationStatus;
  lastVerificationError?: string;
  lastUserCount?: number;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IRewardIntegrationInstanceDocument = HydratedDocument<IRewardIntegrationInstance>;
type RewardIntegrationInstanceModel = Model<IRewardIntegrationInstance>;

const rewardIntegrationInstanceSchema = new Schema<
  IRewardIntegrationInstance,
  RewardIntegrationInstanceModel
>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    provider: {
      type: String,
      enum: ['prizeversity'],
      default: 'prizeversity',
      required: true,
      index: true,
    },
    apiBaseUrl: {
      type: String,
      required: true,
      trim: true,
      default: 'https://www.prizeversity.com',
    },
    apiKey: {
      type: String,
      required: true,
      select: false,
    },
    apiKeyPreview: {
      type: String,
      required: true,
      trim: true,
    },
    classroomId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    classroomName: {
      type: String,
      trim: true,
      default: '',
    },
    scopes: {
      type: [String],
      default: ['users:read', 'users:match', 'reward:grant'],
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
    lastVerificationStatus: {
      type: String,
      enum: ['untested', 'verified', 'failed'],
      default: 'untested',
    },
    lastVerificationError: {
      type: String,
    },
    lastUserCount: {
      type: Number,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
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

rewardIntegrationInstanceSchema.index({ provider: 1, classroomId: 1, active: 1 });
rewardIntegrationInstanceSchema.index({ createdBy: 1, createdAt: -1 });

const RewardIntegrationInstance = mongoose.model<
  IRewardIntegrationInstance,
  RewardIntegrationInstanceModel
>('RewardIntegrationInstance', rewardIntegrationInstanceSchema);

export default RewardIntegrationInstance;
