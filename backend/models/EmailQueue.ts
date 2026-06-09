import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

export type EmailQueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface EmailEventSnapshot {
  title?: string;
  startTime?: Date;
  isRemote?: boolean;
  zoomLink?: string;
  address?: string;
  directions?: string;
  locationName?: string;
  description?: string;
  thumbnailUrl?: string;
  meetupUrl?: string;
}

export interface IEmailQueue {
  email: string;
  fullName: string;
  eventId: Types.ObjectId;
  eventSnapshot: EmailEventSnapshot;
  status: EmailQueueStatus;
  attempts: number;
  maxAttempts: number;
  lastAttempt?: Date;
  nextAttempt: Date;
  lastError?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type IEmailQueueDocument = HydratedDocument<IEmailQueue>;
type EmailQueueModel = Model<IEmailQueue>;

const eventSnapshotSchema = new Schema<EmailEventSnapshot>(
  {
    title: String,
    startTime: Date,
    isRemote: Boolean,
    zoomLink: String,
    address: String,
    directions: String,
    locationName: String,
    description: String,
    thumbnailUrl: String,
    meetupUrl: String,
  },
  { _id: false }
);

const emailQueueSchema = new Schema<IEmailQueue, EmailQueueModel>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    eventSnapshot: eventSnapshotSchema,
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    lastAttempt: {
      type: Date,
    },
    nextAttempt: {
      type: Date,
      default: Date.now,
    },
    lastError: {
      type: String,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

emailQueueSchema.index({ status: 1, nextAttempt: 1 });
emailQueueSchema.index({ eventId: 1 });
emailQueueSchema.index({ email: 1, eventId: 1 }, { unique: true });

const EmailQueue = mongoose.model<IEmailQueue, EmailQueueModel>('EmailQueue', emailQueueSchema);

export default EmailQueue;
