import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

export type RewardIntegrationEmissionStatus = 'pending' | 'sent' | 'failed';

export interface IRewardIntegrationEmission {
  awsUserId: Types.ObjectId;
  prizeversityUserId: string;
  classroomId: string;
  challengeKey: string;
  activityName: string;
  status: RewardIntegrationEmissionStatus;
  requestPayload: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type IRewardIntegrationEmissionDocument = HydratedDocument<IRewardIntegrationEmission>;
type RewardIntegrationEmissionModel = Model<IRewardIntegrationEmission>;

const rewardIntegrationEmissionSchema = new Schema<
  IRewardIntegrationEmission,
  RewardIntegrationEmissionModel
>(
  {
    awsUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
      index: true,
    },
    challengeKey: {
      type: String,
      required: true,
      trim: true,
    },
    activityName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    requestPayload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    responsePayload: {
      type: Schema.Types.Mixed,
    },
    errorMessage: {
      type: String,
    },
    sentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

rewardIntegrationEmissionSchema.index(
  { awsUserId: 1, classroomId: 1, challengeKey: 1 },
  { unique: true }
);

const RewardIntegrationEmission = mongoose.model<
  IRewardIntegrationEmission,
  RewardIntegrationEmissionModel
>('RewardIntegrationEmission', rewardIntegrationEmissionSchema);

export default RewardIntegrationEmission;
