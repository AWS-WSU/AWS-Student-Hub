import mongoose, { HydratedDocument, Model, Schema } from 'mongoose';
import validator from 'validator';

export interface INewsletter {
  email: string;
  subscribedAt: Date;
}

export type INewsletterDocument = HydratedDocument<INewsletter>;
type NewsletterModel = Model<INewsletter>;

const newsletterSchema = new Schema<INewsletter, NewsletterModel>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  subscribedAt: {
    type: Date,
    default: Date.now,
  },
});

const Newsletter = mongoose.model<INewsletter, NewsletterModel>('Newsletter', newsletterSchema);

export default Newsletter;
