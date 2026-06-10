import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

export type EventStatus = 'draft' | 'published';

export interface IEvent {
  title: string;
  startTime: Date;
  isRemote: boolean;
  zoomLink: string;
  address: string;
  directions: string;
  locationName: string;
  description: string;
  thumbnailUrl: string;
  meetupUrl: string;
  status: EventStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IEventDocument = HydratedDocument<IEvent>;
type EventModel = Model<IEvent>;

const eventSchema = new Schema<IEvent, EventModel>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    startTime: {
      type: Date,
      required: true,
    },
    isRemote: {
      type: Boolean,
      required: true,
    },
    zoomLink: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    directions: {
      type: String,
      trim: true,
      maxlength: 250,
      default: '',
    },
    locationName: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      default: '',
    },
    meetupUrl: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Event = mongoose.model<IEvent, EventModel>('Event', eventSchema);

export default Event;
