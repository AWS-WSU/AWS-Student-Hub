import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

export interface IRewardIntegrationMembership {
  awsUserId: Types.ObjectId;
  instanceKey: string;
  rewardIntegrationInstanceId?: Types.ObjectId | null;
  prizeversityUserId: string;
  classroomId: string;
  email?: string;
  matchedName?: string;
  shortId?: string;
  active: boolean;
  disabledByUser: boolean;
  linkedAt: Date;
  lastVerifiedAt?: Date | null;
  lastVerificationError?: string;
  inactiveAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type IRewardIntegrationMembershipDocument = HydratedDocument<IRewardIntegrationMembership>;
type RewardIntegrationMembershipModel = Model<IRewardIntegrationMembership>;

const rewardIntegrationMembershipSchema = new Schema<
  IRewardIntegrationMembership,
  RewardIntegrationMembershipModel
>(
  {
    awsUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    instanceKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    rewardIntegrationInstanceId: {
      type: Schema.Types.ObjectId,
      ref: 'RewardIntegrationInstance',
      default: null,
      index: true,
    },
    prizeversityUserId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    classroomId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
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
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    disabledByUser: {
      type: Boolean,
      default: false,
      index: true,
    },
    linkedAt: {
      type: Date,
      default: Date.now,
    },
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
    lastVerificationError: {
      type: String,
      trim: true,
    },
    inactiveAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

rewardIntegrationMembershipSchema.index({ awsUserId: 1, instanceKey: 1 }, { unique: true });
rewardIntegrationMembershipSchema.index(
  { instanceKey: 1, prizeversityUserId: 1 },
  { unique: true }
);
rewardIntegrationMembershipSchema.index({ awsUserId: 1, active: 1 });

const RewardIntegrationMembership = mongoose.model<
  IRewardIntegrationMembership,
  RewardIntegrationMembershipModel
>('RewardIntegrationMembership', rewardIntegrationMembershipSchema);

export default RewardIntegrationMembership;
