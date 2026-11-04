import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

export type BroadcastStatus = 'sending' | 'completed' | 'failed';

/**
 * A one-shot email blast to the member list. The unique `key` is what makes
 * each broadcast single-use: the first admin to claim the key wins, and every
 * later attempt collides on the index.
 */
export interface IBroadcast {
  key: string;
  status: BroadcastStatus;
  triggeredBy: Types.ObjectId;
  triggeredByEmail: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  startedAt: Date;
  completedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type IBroadcastDocument = HydratedDocument<IBroadcast>;
type BroadcastModel = Model<IBroadcast>;

const broadcastSchema = new Schema<IBroadcast, BroadcastModel>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['sending', 'completed', 'failed'],
      default: 'sending',
    },
    triggeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    triggeredByEmail: {
      type: String,
      required: true,
    },
    recipientCount: {
      type: Number,
      default: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    lastError: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Broadcast = mongoose.model<IBroadcast, BroadcastModel>('Broadcast', broadcastSchema);

export default Broadcast;
