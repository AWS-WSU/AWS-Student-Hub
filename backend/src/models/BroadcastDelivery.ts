import mongoose, { HydratedDocument, Model, Schema } from 'mongoose';

export type BroadcastDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed';

/**
 * One row per recipient of a broadcast. Rows are claimed and sent in small
 * budgeted batches so a large member list never has to fit inside a single
 * Lambda invocation.
 */
export interface IBroadcastDelivery {
  broadcastKey: string;
  email: string;
  fullName: string;
  status: BroadcastDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  nextAttempt: Date;
  lastAttempt?: Date;
  lastError?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type IBroadcastDeliveryDocument = HydratedDocument<IBroadcastDelivery>;
type BroadcastDeliveryModel = Model<IBroadcastDelivery>;

const broadcastDeliverySchema = new Schema<IBroadcastDelivery, BroadcastDeliveryModel>(
  {
    broadcastKey: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    fullName: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 4,
    },
    nextAttempt: {
      type: Date,
      default: Date.now,
    },
    lastAttempt: {
      type: Date,
    },
    lastError: {
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

broadcastDeliverySchema.index({ broadcastKey: 1, email: 1 }, { unique: true });
broadcastDeliverySchema.index({ broadcastKey: 1, status: 1, nextAttempt: 1 });

const BroadcastDelivery = mongoose.model<IBroadcastDelivery, BroadcastDeliveryModel>(
  'BroadcastDelivery',
  broadcastDeliverySchema
);

export default BroadcastDelivery;
