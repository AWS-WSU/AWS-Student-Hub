import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

export type ChallengeStatus = 'draft' | 'published' | 'archived';
export type ChallengeSource = 'curated' | 'custom';
export type ChallengeKind = 'single' | 'multi_part';
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type ChallengeXpMode = 'none' | 'classroom' | 'custom';

export interface IChallengeRewardConfig {
  enabled: boolean;
  bits: number;
  xpAmount?: number;
  xpMode?: ChallengeXpMode;
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

export interface IChallenge {
  key: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  instructions?: string;
  source: ChallengeSource;
  status: ChallengeStatus;
  kind: ChallengeKind;
  difficulty: ChallengeDifficulty;
  estimatedMinutes?: number;
  tags: string[];
  version: number;
  assignmentMigrationVersion?: number;
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxAttempts?: number;
  rewardIntegrationInstanceId?: Types.ObjectId | null;
  validation: Record<string, unknown>;
  reward: IChallengeRewardConfig;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IChallengeDocument = HydratedDocument<IChallenge>;
type ChallengeModel = Model<IChallenge>;

export const challengeRewardSchema = new Schema<IChallengeRewardConfig>(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    bits: {
      type: Number,
      default: 0,
      min: 0,
    },
    xpAmount: {
      type: Number,
      min: 0,
    },
    xpMode: {
      type: String,
      enum: ['none', 'classroom', 'custom'],
      default: 'custom',
    },
    activityName: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    stats: {
      multiplier: { type: Number },
      luck: { type: Number },
      shield: { type: Number },
      discount: { type: Number },
    },
    applyGroupMultipliers: {
      type: Boolean,
      default: true,
    },
    applyPersonalMultipliers: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const challengeSchema = new Schema<IChallenge, ChallengeModel>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: /^[a-z0-9][a-z0-9-_]*$/,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 140,
      match: /^[a-z0-9][a-z0-9-]*$/,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: 10000,
    },
    source: {
      type: String,
      enum: ['curated', 'custom'],
      default: 'custom',
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    kind: {
      type: String,
      enum: ['single', 'multi_part'],
      default: 'single',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'expert'],
      default: 'easy',
      index: true,
    },
    estimatedMinutes: {
      type: Number,
      min: 1,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    assignmentMigrationVersion: {
      type: Number,
      min: 1,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
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
    rewardIntegrationInstanceId: {
      type: Schema.Types.ObjectId,
      ref: 'RewardIntegrationInstance',
      default: null,
      index: true,
    },
    validation: {
      type: Schema.Types.Mixed,
      required: true,
    },
    reward: {
      type: challengeRewardSchema,
      default: () => ({ enabled: false, bits: 0 }),
    },
    createdBy: {
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

challengeSchema.index({ status: 1, startsAt: 1, endsAt: 1 });
challengeSchema.index({ status: 1, rewardIntegrationInstanceId: 1 });
challengeSchema.index({ 'validation.type': 1, 'validation.routeKey': 1 });

const Challenge = mongoose.model<IChallenge, ChallengeModel>('Challenge', challengeSchema);

export default Challenge;
