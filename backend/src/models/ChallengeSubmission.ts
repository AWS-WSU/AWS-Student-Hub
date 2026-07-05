import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

export type ChallengeSubmissionStatus = 'accepted' | 'pending_review' | 'rejected' | 'error';

export interface IChallengeSubmission {
  userId: Types.ObjectId;
  challengeId: Types.ObjectId;
  progressId: Types.ObjectId;
  challengeKey: string;
  validatorType: string;
  status: ChallengeSubmissionStatus;
  submittedPayloadPreview: Record<string, unknown>;
  validationResult: Record<string, unknown>;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type IChallengeSubmissionDocument = HydratedDocument<IChallengeSubmission>;
type ChallengeSubmissionModel = Model<IChallengeSubmission>;

const challengeSubmissionSchema = new Schema<IChallengeSubmission, ChallengeSubmissionModel>(
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
    progressId: {
      type: Schema.Types.ObjectId,
      ref: 'ChallengeProgress',
      required: true,
      index: true,
    },
    challengeKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    validatorType: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['accepted', 'pending_review', 'rejected', 'error'],
      required: true,
      index: true,
    },
    submittedPayloadPreview: {
      type: Schema.Types.Mixed,
      default: {},
    },
    validationResult: {
      type: Schema.Types.Mixed,
      default: {},
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

challengeSubmissionSchema.index({ userId: 1, challengeId: 1, createdAt: -1 });
challengeSubmissionSchema.index({ progressId: 1, createdAt: -1 });

const ChallengeSubmission = mongoose.model<IChallengeSubmission, ChallengeSubmissionModel>(
  'ChallengeSubmission',
  challengeSubmissionSchema
);

export default ChallengeSubmission;
