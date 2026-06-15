import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

export type UserRole = 'member' | 'moderator' | 'admin' | 'superuser';
export type UserStatus = 'active' | 'banned' | 'suspended';
export type UserGrade = '' | 'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Graduate' | 'Other';

export interface RefreshTokenEntry {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  deviceId: string;
}

export interface IUser {
  username?: string;
  fullName: string;
  email: string;
  password: string;
  auth0Id?: string;
  profilePicture: string;
  bio: string;
  major: string;
  grade: UserGrade;
  programmingLanguages: string[];
  profileSetupCompleted: boolean;
  role: UserRole;
  status: UserStatus;
  bannedAt?: Date | null;
  bannedBy?: Types.ObjectId | null;
  banReason?: string | null;
  wantsEmails: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  refreshTokens: RefreshTokenEntry[];
  tokenVersion: number;
  nextChallengePassword?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  hasViewedAwsCredentials: boolean;
  rewardIntegrationInstanceId?: Types.ObjectId | null;
  prizeversityUserId?: string;
  prizeversityClassroomId?: string;
  prizeversityEmail?: string;
  prizeversityMatchedName?: string;
  prizeversityShortId?: string;
  prizeversityLinkedAt?: Date | null;
  prizeversityLastSyncedAt?: Date | null;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  toSafeObject(): Record<string, unknown>;
  generateResetToken(): string;
  clearResetToken(): void;
  generateRefreshToken(deviceId: string, rememberMe?: boolean): string;
  validateRefreshToken(token: string, deviceId: string): boolean;
  revokeRefreshToken(token: string): void;
  revokeAllRefreshTokens(): void;
  cleanExpiredRefreshTokens(): void;
}

export type IUserDocument = HydratedDocument<IUser, IUserMethods>;
type UserModel = Model<IUser, Record<string, never>, IUserMethods>;

const refreshTokenSchema = new Schema<RefreshTokenEntry>(
  {
    token: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    username: {
      type: String,
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [30, 'Username cannot be more than 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters long'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false,
    },
    auth0Id: {
      type: String,
      sparse: true,
      unique: true,
    },
    profilePicture: {
      type: String,
      default: '/avatar.jpg',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot be more than 500 characters'],
      default: '',
    },
    major: {
      type: String,
      trim: true,
      maxlength: [100, 'Major cannot be more than 100 characters'],
      default: '',
    },
    grade: {
      type: String,
      enum: ['', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Other'],
      default: '',
    },
    programmingLanguages: [
      {
        type: String,
        trim: true,
      },
    ],
    profileSetupCompleted: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'admin', 'superuser'],
      default: 'member',
    },
    status: {
      type: String,
      enum: ['active', 'banned', 'suspended'],
      default: 'active',
    },
    bannedAt: {
      type: Date,
      default: null,
    },
    bannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    banReason: {
      type: String,
      default: null,
    },
    wantsEmails: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    refreshTokens: [refreshTokenSchema],
    tokenVersion: {
      type: Number,
      default: 0,
    },
    nextChallengePassword: {
      type: String,
      select: false,
    },
    awsAccessKeyId: {
      type: String,
      select: false,
    },
    awsSecretAccessKey: {
      type: String,
      select: false,
    },
    hasViewedAwsCredentials: {
      type: Boolean,
      default: false,
    },
    rewardIntegrationInstanceId: {
      type: Schema.Types.ObjectId,
      ref: 'RewardIntegrationInstance',
      default: null,
      index: true,
    },
    prizeversityUserId: {
      type: String,
      trim: true,
      index: true,
    },
    prizeversityClassroomId: {
      type: String,
      trim: true,
      index: true,
    },
    prizeversityEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    prizeversityMatchedName: {
      type: String,
      trim: true,
    },
    prizeversityShortId: {
      type: String,
      trim: true,
    },
    prizeversityLinkedAt: {
      type: Date,
      default: null,
    },
    prizeversityLastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

userSchema.pre('save', async function (next) {
  if (this.isNew && !this.username) {
    const baseUsername = this.email.split('@')[0];
    let username = baseUsername;
    let counter = 1;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        const existingUser = await (this.constructor as UserModel).findOne({ username });
        if (!existingUser) {
          this.username = username;
          break;
        }
        username = `${baseUsername}${counter}`;
        counter++;
        attempts++;
      } catch (error) {
        next(error as Error);
        return;
      }
    }

    if (attempts >= maxAttempts) {
      this.username = `${baseUsername}_${Date.now()}`;
    }
  }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function (): Record<string, unknown> {
  const obj = this.toObject() as Record<string, unknown>;
  delete obj.password;
  return obj;
};

userSchema.methods.generateResetToken = function (): string {
  const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
  this.resetPasswordToken = resetToken;
  this.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
  return resetToken;
};

userSchema.methods.clearResetToken = function (): void {
  this.resetPasswordToken = undefined;
  this.resetPasswordExpires = undefined;
};

userSchema.methods.generateRefreshToken = function (deviceId: string, rememberMe = false): string {
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const expirationDays = rememberMe ? 30 : 7;
  const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

  this.refreshTokens = this.refreshTokens.filter(
    (token: RefreshTokenEntry) => token.deviceId !== deviceId && token.expiresAt > new Date()
  );

  this.refreshTokens.push({
    token: refreshToken,
    createdAt: new Date(),
    expiresAt,
    deviceId,
  });

  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens
      .sort(
        (a: RefreshTokenEntry, b: RefreshTokenEntry) =>
          b.createdAt.getTime() - a.createdAt.getTime()
      )
      .slice(0, 5);
  }

  return refreshToken;
};

userSchema.methods.validateRefreshToken = function (token: string, deviceId: string): boolean {
  const tokenEntry = this.refreshTokens.find(
    (entry: RefreshTokenEntry) =>
      entry.token === token && entry.deviceId === deviceId && entry.expiresAt > new Date()
  );
  return Boolean(tokenEntry);
};

userSchema.methods.revokeRefreshToken = function (token: string): void {
  this.refreshTokens = this.refreshTokens.filter(
    (entry: RefreshTokenEntry) => entry.token !== token
  );
};

userSchema.methods.revokeAllRefreshTokens = function (): void {
  this.refreshTokens = [];
  this.tokenVersion += 1;
};

userSchema.methods.cleanExpiredRefreshTokens = function (): void {
  this.refreshTokens = this.refreshTokens.filter(
    (token: RefreshTokenEntry) => token.expiresAt > new Date()
  );
};

const User = mongoose.model<IUser, UserModel>('User', userSchema);

export default User;
