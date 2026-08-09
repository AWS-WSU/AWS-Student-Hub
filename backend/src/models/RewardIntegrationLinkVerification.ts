import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

export interface IRewardIntegrationLinkVerification {
  awsUserId: Types.ObjectId;
  instanceKey?: string;
  rewardIntegrationInstanceId?: Types.ObjectId | null;
  prizeversityUserId: string;
  classroomId: string;
  email: string;
  matchedName?: string;
  shortId?: string;
  codeHash: string;
  codeSalt: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type IRewardIntegrationLinkVerificationDocument =
  HydratedDocument<IRewardIntegrationLinkVerification>;
type RewardIntegrationLinkVerificationModel = Model<IRewardIntegrationLinkVerification>;

const rewardIntegrationLinkVerificationSchema = new Schema<
  IRewardIntegrationLinkVerification,
  RewardIntegrationLinkVerificationModel
>(
  {
    awsUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    rewardIntegrationInstanceId: {
      type: Schema.Types.ObjectId,
      ref: 'RewardIntegrationInstance',
      default: null,
    },
    instanceKey: {
      type: String,
      trim: true,
    },
    prizeversityUserId: {
      type: String,
      required: true,
      trim: true,
    },
    classroomId: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    matchedName: {
      type: String,
      trim: true,
    },
    shortId: {
      type: String,
      trim: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    codeSalt: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

rewardIntegrationLinkVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RewardIntegrationLinkVerification = mongoose.model<
  IRewardIntegrationLinkVerification,
  RewardIntegrationLinkVerificationModel
>('RewardIntegrationLinkVerification', rewardIntegrationLinkVerificationSchema);

export default RewardIntegrationLinkVerification;
