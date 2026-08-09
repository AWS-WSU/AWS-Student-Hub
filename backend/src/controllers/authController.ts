import type { Request, Response } from 'express';
import crypto from 'crypto';
import Filter from 'bad-words';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';

import env from '../config/env';
import User from '../models/User';
import type { UserGrade } from '../models/User';
import { createChallengeUser } from '../services/awsProvision';
import { sendResetCode } from '../services/emailService';
import { memberSearchIndex } from '../services/memberSearchIndex';
import { verifyAuth0IdToken } from '../services/auth0Service';
import logger from '../config/logger';

const log = logger.child({ module: 'authController' });

interface TokenUser {
  _id: unknown;
  email: string;
  tokenVersion: number;
  generateRefreshToken: (deviceId: string, rememberMe?: boolean) => string;
}

interface AuthResponseBody {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  rememberMe: boolean;
  user: Record<string, unknown>;
  awsCredentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

interface AwsCredentialUser {
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  prizeversityUserId?: string;
  prizeversityClassroomId?: string;
}

const filter = new Filter();
const CURRENT_POLICY_VERSION = '2026-06-21';
const PASSWORD_RESET_REQUEST_MESSAGE =
  'If an account exists for that email, a verification code is on its way. If it does not arrive, check your spam or junk folder.';

const getJwtSecret = (): string => {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return env.JWT_SECRET;
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const getErrorName = (error: unknown): string => {
  return error instanceof Error ? error.name : '';
};

const getErrorCode = (error: unknown): number | string | undefined => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { code?: number | string }).code;
  }
  return undefined;
};

const hasConnectionError = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  const name = getErrorName(error);
  return (
    name === 'MongoServerSelectionError' ||
    name === 'MongoNetworkError' ||
    message.includes('connection')
  );
};

const parseInteger = (value: unknown, fallback: number): number => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const queryString = (value: unknown): string => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' ? rawValue : '';
};

const generateDeviceId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

const generateTokens = (user: TokenUser, deviceId: string, rememberMe = false) => {
  if (env.IS_LAMBDA) {
    log.info('lambda environment detected.');
    log.info('jwt secret exists.', !!env.JWT_SECRET);
    log.info('jwt secret length.', env.JWT_SECRET ? env.JWT_SECRET.length : 0);
  }

  const accessToken = jwt.sign(
    {
      id: user._id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    },
    getJwtSecret(),
    { expiresIn: '15m' }
  );

  const refreshToken = user.generateRefreshToken(deviceId, rememberMe);

  return { accessToken, refreshToken };
};

const hasPrizeversityChallengeLink = (user: AwsCredentialUser): boolean => {
  return Boolean(user.prizeversityUserId && user.prizeversityClassroomId);
};

const attachAwsCredentialsIfLinked = (
  userObj: Record<string, unknown>,
  user: AwsCredentialUser
): void => {
  delete userObj.awsAccessKeyId;
  delete userObj.awsSecretAccessKey;

  if (hasPrizeversityChallengeLink(user) && user.awsAccessKeyId && user.awsSecretAccessKey) {
    userObj.awsAccessKeyId = user.awsAccessKeyId;
    userObj.awsSecretAccessKey = user.awsSecretAccessKey;
  }
};

const hasPolicyAcknowledgement = (user: {
  privacyPolicyAcknowledgedAt?: Date | null;
  codeOfConductAcknowledgedAt?: Date | null;
}): boolean => {
  return Boolean(user.privacyPolicyAcknowledgedAt && user.codeOfConductAcknowledgedAt);
};

const applyPolicyAcknowledgement = (user: {
  privacyPolicyAcknowledgedAt?: Date | null;
  privacyPolicyVersion?: string;
  codeOfConductAcknowledgedAt?: Date | null;
}): void => {
  const acknowledgedAt = new Date();
  user.privacyPolicyAcknowledgedAt = acknowledgedAt;
  user.privacyPolicyVersion = CURRENT_POLICY_VERSION;
  user.codeOfConductAcknowledgedAt = acknowledgedAt;
};

const getRefreshTokenRememberMe = (
  user: {
    refreshTokens?: Array<{
      token: string;
      deviceId: string;
      expiresAt: Date;
      rememberMe?: boolean;
    }>;
  },
  refreshToken: string,
  deviceId: string
): boolean => {
  const tokenEntry = user.refreshTokens?.find(
    (entry) => entry.token === refreshToken && entry.deviceId === deviceId
  );
  if (!tokenEntry) return false;
  if (typeof tokenEntry.rememberMe === 'boolean') return tokenEntry.rememberMe;

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expiresAt =
    tokenEntry.expiresAt instanceof Date ? tokenEntry.expiresAt : new Date(tokenEntry.expiresAt);
  return expiresAt.getTime() - Date.now() > sevenDaysMs;
};

const generateUsername = async (email: string): Promise<string> => {
  const emailPrefix = email.split('@')[0] || 'member';
  const normalizedPrefix = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24);
  const baseUsername = normalizedPrefix.length >= 3 ? normalizedPrefix : `user_${normalizedPrefix}`;
  let username = baseUsername;
  let counter = 1;

  while (true) {
    const existingUser = await User.findOne({ username });
    if (!existingUser) {
      return username;
    }
    username = `${baseUsername}${counter}`;
    counter++;
  }
};

export const auth0Login = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { idToken, deviceId, rememberMe, acceptedPolicies } = req.body as {
      idToken: string;
      deviceId?: string;
      rememberMe?: boolean;
      acceptedPolicies?: boolean;
    };

    const identity = await verifyAuth0IdToken(idToken);
    if (!identity.subject.startsWith('google-oauth2|')) {
      res.status(401).json({ error: 'The identity is not from the configured Google connection.' });
      return;
    }

    if (!identity.emailVerified) {
      res.status(401).json({ error: 'Google must verify the email address before sign-in.' });
      return;
    }

    let user = await User.findOne({ auth0Id: identity.subject }).select(
      '+awsAccessKeyId +awsSecretAccessKey'
    );

    if (!user) {
      const emailUser = await User.findOne({ email: identity.email }).select(
        '+awsAccessKeyId +awsSecretAccessKey'
      );

      if (emailUser?.auth0Id && emailUser.auth0Id !== identity.subject) {
        res.status(409).json({ error: 'This email is already linked to another social account.' });
        return;
      }

      user = emailUser;
    }

    if (user && (user.status || 'active') !== 'active') {
      res.status(403).json({ error: `Account is ${user.status}. Access denied.` });
      return;
    }

    if (!user) {
      if (!acceptedPolicies) {
        res.status(403).json({
          error: 'You must acknowledge the Privacy Policy and WSU conduct expectations.',
          acknowledgementRequired: true,
          policyVersion: CURRENT_POLICY_VERSION,
        });
        return;
      }

      const username = await generateUsername(identity.email);
      const fullName =
        identity.name?.trim() ||
        identity.nickname?.trim() ||
        identity.email.split('@')[0] ||
        'User';

      user = new User({
        auth0Id: identity.subject,
        username,
        fullName: fullName.length >= 2 ? fullName : 'Google User',
        email: identity.email,
        password: `${crypto.randomBytes(48).toString('base64url')}Aa1!`,
        profilePicture: identity.picture || '/avatar.jpg',
      });
      applyPolicyAcknowledgement(user);

      try {
        const challengeUserResult = await createChallengeUser(username);
        user.nextChallengePassword = challengeUserResult.password;
        user.awsAccessKeyId = challengeUserResult.access_key;
        user.awsSecretAccessKey = challengeUserResult.secret_key;
      } catch (awsError: unknown) {
        log.error(`failed to create aws challenge user for social account ${username}.`, awsError);
      }
    } else {
      user.auth0Id = identity.subject;
      if (identity.picture && (!user.profilePicture || user.profilePicture === '/avatar.jpg')) {
        user.profilePicture = identity.picture;
      }

      if (!hasPolicyAcknowledgement(user)) {
        if (!acceptedPolicies) {
          res.status(403).json({
            error: 'You must acknowledge the Privacy Policy and WSU conduct expectations.',
            acknowledgementRequired: true,
            policyVersion: CURRENT_POLICY_VERSION,
          });
          return;
        }
        applyPolicyAcknowledgement(user);
      }
    }

    const currentDeviceId = deviceId || generateDeviceId();
    user.cleanExpiredRefreshTokens();
    const { accessToken, refreshToken } = generateTokens(user, currentDeviceId, !!rememberMe);

    user.lastLogin = new Date();
    await user.save();

    const userObj = user.toSafeObject();
    attachAwsCredentialsIfLinked(userObj, user);

    res.json({
      accessToken,
      refreshToken,
      deviceId: currentDeviceId,
      rememberMe: !!rememberMe,
      user: userObj,
    });
  } catch (error: unknown) {
    log.error('auth0 login error.', error);

    if (getErrorMessage(error).includes('configuration is incomplete')) {
      res.status(503).json({ error: 'Google sign-in is not configured on the server.' });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Google sign-in token is invalid or expired.' });
      return;
    }

    if (hasConnectionError(error)) {
      res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
      return;
    }

    if (getErrorCode(error) === 11000) {
      res.status(409).json({ error: 'This Google account is already linked.' });
      return;
    }

    res.status(500).json({ error: 'Server error during Google sign-in.' });
  }
};

function normalizeInput(str: string): string {
  return str
    .toLowerCase()
    .replace(/[!1|i]/g, 'i')
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/0/g, 'o')
    .replace(/[^a-z]/g, '');
}

function containsProfanity(input: unknown): boolean {
  if (!input || typeof input !== 'string') return false;
  const normalized = normalizeInput(input);
  return filter.isProfane(input) || filter.isProfane(normalized);
}

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const {
      fullName,
      email,
      password,
      username: providedUsername,
      deviceId,
      rememberMe,
      acceptedPolicies,
    } = req.body as {
      fullName: string;
      email: string;
      password: string;
      username?: string;
      deviceId?: string;
      rememberMe?: boolean;
      acceptedPolicies?: boolean;
    };

    if (!acceptedPolicies) {
      res.status(400).json({
        error: 'You must acknowledge the Privacy Policy and WSU conduct expectations.',
      });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({
        error: existingUser.auth0Id
          ? 'An account already exists for this email and uses Google sign-in. Continue with Google instead.'
          : 'An account already exists for this email. Sign in or reset your password instead.',
      });
      return;
    }

    if (providedUsername) {
      const existingUsername = await User.findOne({ username: providedUsername });
      if (existingUsername) {
        res
          .status(409)
          .json({ error: 'That username is already in use. Choose another username.' });
        return;
      }
    }

    const fieldsToCheck = [
      { name: 'username', value: providedUsername },
      { name: 'full name', value: fullName },
      { name: 'email', value: email },
    ];

    for (const field of fieldsToCheck) {
      if (field.value && containsProfanity(field.value)) {
        res.status(400).json({
          error: `Hey, that's not nice. Try again.`,
        });
        return;
      }
    }

    const username = providedUsername || (await generateUsername(email));

    const user = new User({
      username,
      fullName,
      email,
      password,
    });
    applyPolicyAcknowledgement(user);

    const currentDeviceId = deviceId || generateDeviceId();
    const { accessToken, refreshToken } = generateTokens(user, currentDeviceId, !!rememberMe);

    user.lastLogin = new Date();

    let awsCredentials: AuthResponseBody['awsCredentials'];
    try {
      log.info(`creating aws challenge user for ${username}.`);
      log.info('aws admin access key id exists.', !!env.AWS_ADMIN_ACCESS_KEY_ID);
      log.info('aws admin secret access key exists.', !!env.AWS_ADMIN_SECRET_ACCESS_KEY);
      log.info('aws s3 bucket.', env.AWS_S3_BUCKET);

      const challengeUserResult = await createChallengeUser(username);

      user.nextChallengePassword = challengeUserResult.password;
      user.awsAccessKeyId = challengeUserResult.access_key;
      user.awsSecretAccessKey = challengeUserResult.secret_key;

      awsCredentials = {
        accessKeyId: challengeUserResult.access_key,
        secretAccessKey: challengeUserResult.secret_key,
      };

      log.info(`successfully created aws challenge user for ${username}.`);
      log.info(`aws access key id prefix ${challengeUserResult.access_key.substring(0, 8)}.`);
    } catch (awsError: unknown) {
      log.error(`failed to create aws challenge user for ${username}.`, awsError);
      log.error('aws error details.', {
        message: getErrorMessage(awsError),
        code: getErrorCode(awsError),
        stack: awsError instanceof Error ? awsError.stack : undefined,
      });
    }

    await user.save();

    const userObj = user.toSafeObject();
    attachAwsCredentialsIfLinked(userObj, user);

    const response: AuthResponseBody = {
      accessToken,
      refreshToken,
      deviceId: currentDeviceId,
      rememberMe: !!rememberMe,
      user: userObj,
    };

    if (awsCredentials && hasPrizeversityChallengeLink(user)) {
      response.awsCredentials = awsCredentials;
    }

    res.status(201).json(response);
  } catch (error: unknown) {
    log.error('signup error.', error);

    if (getErrorCode(error) === 11000) {
      res.status(409).json({
        error:
          'An account already exists with that email or username. Sign in or choose different information.',
      });
      return;
    }

    res.status(500).json({ error: 'Server error during signup' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, deviceId, rememberMe, acceptedPolicies } = req.body as {
      email: string;
      password: string;
      deviceId?: string;
      rememberMe?: boolean;
      acceptedPolicies?: boolean;
    };

    let user;
    const isEmail = email.includes('@');

    if (isEmail) {
      user = await User.findOne({ email }).select('+password +awsAccessKeyId +awsSecretAccessKey');
    } else {
      user = await User.findOne({ username: email }).select(
        '+password +awsAccessKeyId +awsSecretAccessKey'
      );
    }

    if (!user) {
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    if (user.auth0Id?.startsWith('google-oauth2|')) {
      res.status(409).json({
        error:
          'This account uses Google sign-in. Continue with Google to access it, and reset its password through Google if needed.',
      });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    if (!hasPolicyAcknowledgement(user)) {
      if (!acceptedPolicies) {
        res.status(403).json({
          error: 'You must acknowledge the Privacy Policy and WSU conduct expectations.',
          acknowledgementRequired: true,
          policyVersion: CURRENT_POLICY_VERSION,
        });
        return;
      }

      applyPolicyAcknowledgement(user);
    }

    const currentDeviceId = deviceId || generateDeviceId();

    user.cleanExpiredRefreshTokens();

    const { accessToken, refreshToken } = generateTokens(user, currentDeviceId, !!rememberMe);

    user.lastLogin = new Date();
    await user.save();

    const userObj = user.toSafeObject();
    attachAwsCredentialsIfLinked(userObj, user);

    res.json({
      accessToken,
      refreshToken,
      deviceId: currentDeviceId,
      rememberMe: !!rememberMe,
      user: userObj,
    });
  } catch (error: unknown) {
    log.error('login error.', error);

    if (hasConnectionError(error)) {
      res.status(503).json({
        error: 'Service temporarily unavailable. Please try again.',
      });
      return;
    }

    res.status(500).json({
      error: 'Server error during login',
    });
  }
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await User.findById(req.user.id).select('+awsAccessKeyId +awsSecretAccessKey');
    if (!user) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    const userObj = user.toSafeObject();
    attachAwsCredentialsIfLinked(userObj, user);

    res.json(userObj);
  } catch (error: unknown) {
    log.error('get current user error.', error);
    res.status(500).json({
      error: 'Server error while fetching user',
    });
  }
};

export const checkUsername = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body as { username?: string };
    const currentUserId = req.user?.id;

    if (!currentUserId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!username) {
      res.status(400).json({
        success: false,
        message: 'Username is required',
      });
      return;
    }

    const existingUser = await User.findOne({
      username,
      _id: { $ne: currentUserId },
    });

    res.json({
      success: true,
      available: !existingUser,
      message: existingUser ? 'Username is already taken' : 'Username is available',
    });
  } catch (error: unknown) {
    log.error('check username error.', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking username',
    });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const {
      bio,
      major,
      grade,
      programmingLanguages,
      profileSetupCompleted,
      wantsEmails,
      fullName,
      username,
    } = req.body as {
      bio?: string;
      major?: string;
      grade?: UserGrade;
      programmingLanguages?: string[];
      profileSetupCompleted?: boolean;
      wantsEmails?: boolean;
      fullName?: string;
      username?: string;
    };

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    if (bio !== undefined) user.bio = bio;
    if (major !== undefined) user.major = major;
    if (grade !== undefined) user.grade = grade;
    if (programmingLanguages !== undefined) user.programmingLanguages = programmingLanguages;
    if (profileSetupCompleted !== undefined) user.profileSetupCompleted = profileSetupCompleted;
    if (wantsEmails !== undefined) user.wantsEmails = wantsEmails;
    if (fullName !== undefined) user.fullName = fullName;
    if (username !== undefined) user.username = username;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toSafeObject(),
    });
  } catch (error: unknown) {
    log.error('update profile error.', error);
    res.status(500).json({
      error: 'Server error while updating profile',
    });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier } = req.body as { identifier?: string };

    if (!identifier) {
      res.status(400).json({
        error: 'Email or username is required',
      });
      return;
    }

    let user;
    const isEmail = identifier.includes('@');

    if (isEmail) {
      user = await User.findOne({ email: identifier.toLowerCase() });
    } else {
      user = await User.findOne({ username: identifier });
    }

    if (!user) {
      res.json({
        success: true,
        message: isEmail
          ? PASSWORD_RESET_REQUEST_MESSAGE
          : 'If an account exists with this username, you will need to verify your email address.',
      });
      return;
    }

    if (user.auth0Id) {
      res.status(409).json({
        error:
          'This account uses Google sign-in. Continue with Google to access it, and reset its password through Google if needed.',
      });
      return;
    }

    if (!isEmail) {
      const censoredEmail = user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      res.json({
        success: true,
        needsEmailVerification: true,
        censoredEmail,
        message:
          'Please enter the email address associated with this username to verify your identity.',
      });
      return;
    }

    const resetToken = user.generateResetToken();
    await user.save();

    await sendResetCode(user.email, resetToken, user.fullName);

    res.json({
      success: true,
      message: PASSWORD_RESET_REQUEST_MESSAGE,
    });
  } catch (error: unknown) {
    log.error('forgot password error.', error);
    res.status(500).json({
      error: 'Server error while processing password reset request',
    });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email } = req.body as { username?: string; email?: string };

    if (!username || !email) {
      res.status(400).json({
        error: 'Username and email are required',
      });
      return;
    }

    const user = await User.findOne({
      username,
      email: email.toLowerCase(),
    });

    if (!user) {
      res.json({
        success: true,
        message: 'If the email matches the username, a reset code has been sent.',
      });
      return;
    }

    if (user.auth0Id) {
      res.status(409).json({
        error:
          'This account uses Google sign-in. Continue with Google to access it, and reset its password through Google if needed.',
      });
      return;
    }

    const resetToken = user.generateResetToken();
    await user.save();

    await sendResetCode(user.email, resetToken, user.fullName);

    res.json({
      success: true,
      message: 'If the email matches the username, a reset code has been sent.',
    });
  } catch (error: unknown) {
    log.error('email verification error.', error);
    res.status(500).json({
      error: 'Server error while verifying email',
    });
  }
};

export const verifyResetCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, code } = req.body as { identifier?: string; code?: string };

    if (!identifier || !code) {
      res.status(400).json({
        error: 'Email/username and reset code are required',
      });
      return;
    }

    let user;
    const isEmail = identifier.includes('@');

    if (isEmail) {
      user = await User.findOne({
        email: identifier.toLowerCase(),
        resetPasswordToken: code,
        resetPasswordExpires: { $gt: Date.now() },
      }).select('+resetPasswordToken +resetPasswordExpires');
    } else {
      user = await User.findOne({
        username: identifier,
        resetPasswordToken: code,
        resetPasswordExpires: { $gt: Date.now() },
      }).select('+resetPasswordToken +resetPasswordExpires');
    }

    if (!user) {
      res.status(400).json({
        error: 'Invalid or expired reset code',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Reset code verified successfully. You can now set a new password.',
      resetToken: code,
    });
  } catch (error: unknown) {
    log.error('verify reset code error.', error);
    res.status(500).json({
      error: 'Server error while verifying reset code',
    });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, code, newPassword } = req.body as {
      identifier?: string;
      code?: string;
      newPassword?: string;
    };

    if (!identifier || !code || !newPassword) {
      res.status(400).json({
        error: 'All fields are required',
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        error: 'Password must be at least 6 characters long',
      });
      return;
    }

    let user;
    const isEmail = identifier.includes('@');

    if (isEmail) {
      user = await User.findOne({
        email: identifier.toLowerCase(),
        resetPasswordToken: code,
        resetPasswordExpires: { $gt: Date.now() },
      }).select('+resetPasswordToken +resetPasswordExpires +password');
    } else {
      user = await User.findOne({
        username: identifier,
        resetPasswordToken: code,
        resetPasswordExpires: { $gt: Date.now() },
      }).select('+resetPasswordToken +resetPasswordExpires +password');
    }

    if (!user) {
      res.status(400).json({
        error: 'Invalid or expired reset code',
      });
      return;
    }

    user.password = newPassword;
    user.clearResetToken();
    await user.save();

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    });
  } catch (error: unknown) {
    log.error('reset password error.', error);
    res.status(500).json({
      error: 'Server error while resetting password',
    });
  }
};

export const getRecentUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInteger(req.query.limit, 6);

    const recentUsers = await User.find({})
      .select('username fullName profilePicture createdAt')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      users: recentUsers,
    });
  } catch (error: unknown) {
    log.error('get recent users error.', error);
    if (hasConnectionError(error)) {
      res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable. Please try again.',
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Server error while fetching recent users',
    });
  }
};

export const getPublicProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username }).select(
      'username fullName profilePicture bio major grade programmingLanguages role createdAt lastLogin'
    );

    if (!user) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    const now = new Date();
    const createdAt = new Date(user.createdAt);
    const lastLogin = new Date(user.lastLogin);

    const daysSinceJoin = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceLastSeen = Math.floor(
      (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)
    );

    const memberSince = createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const profileData = {
      username: user.username,
      fullName: user.fullName,
      profilePicture: user.profilePicture,
      bio: user.bio || '',
      major: user.major || '',
      grade: user.grade || '',
      programmingLanguages: user.programmingLanguages || [],
      role: user.role || 'member',
      lastLogin: user.lastLogin,
      stats: {
        memberSince,
        daysSinceJoin,
        daysSinceLastSeen,
      },
    };

    res.json({
      success: true,
      profile: profileData,
    });
  } catch (error: unknown) {
    log.error('get public profile error.', error);
    res.status(500).json({
      error: 'Server error while fetching profile',
    });
  }
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = queryString(req.query.q).trim();
    const limit = parseInteger(req.query.limit, 10);

    if (!q || q.length < 2) {
      res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long',
      });
      return;
    }

    if (q.length > 64) {
      res.status(400).json({
        success: false,
        error: 'Search query cannot exceed 64 characters',
      });
      return;
    }

    if (await memberSearchIndex.isDefinitelyMissing(q)) {
      res.json({
        success: true,
        users: [],
      });
      return;
    }

    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedQuery, 'i');
    const searchLimit = Math.min(limit, 20);

    const users = await User.find({
      $or: [{ username: searchRegex }, { fullName: searchRegex }],
    })
      .select('username fullName profilePicture createdAt')
      .limit(searchLimit)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users,
    });
  } catch (error: unknown) {
    log.error('search users error.', error);
    res.status(500).json({
      success: false,
      error: 'Server error while searching users',
    });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken, deviceId } = req.body as { refreshToken?: string; deviceId?: string };

    if (!refreshToken || !deviceId) {
      res.status(400).json({
        error: 'Refresh token and device ID are required',
      });
      return;
    }

    const user = await User.findOne({
      'refreshTokens.token': refreshToken,
      'refreshTokens.deviceId': deviceId,
    });

    if (!user) {
      res.status(401).json({
        error: 'Invalid refresh token',
      });
      return;
    }

    if (!user.validateRefreshToken(refreshToken, deviceId)) {
      res.status(401).json({
        error: 'Refresh token expired or invalid',
      });
      return;
    }

    const rememberMe = getRefreshTokenRememberMe(user, refreshToken, deviceId);

    user.cleanExpiredRefreshTokens();

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user,
      deviceId,
      rememberMe
    );

    user.revokeRefreshToken(refreshToken);

    await user.save();

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      deviceId,
      rememberMe,
      user: user.toSafeObject(),
    });
  } catch (error: unknown) {
    log.error('refresh token error.', error);
    res.status(500).json({
      error: 'Server error during token refresh',
    });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken, deviceId, allDevices } = req.body as {
      refreshToken?: string;
      deviceId?: string;
      allDevices?: boolean;
    };
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    if (allDevices) {
      user.revokeAllRefreshTokens();
    } else if (refreshToken) {
      user.revokeRefreshToken(refreshToken);
    } else if (deviceId) {
      user.refreshTokens = (Array.isArray(user.refreshTokens) ? user.refreshTokens : []).filter(
        (token: { deviceId: string }) => token.deviceId !== deviceId
      );
    }

    await user.save();

    res.json({
      success: true,
      message: allDevices ? 'Logged out from all devices' : 'Logged out successfully',
    });
  } catch (error: unknown) {
    log.error('logout error.', error);
    res.status(500).json({
      error: 'Server error during logout',
    });
  }
};

export const getAwsCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body as { password?: string };
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!password) {
      res.status(400).json({
        error: 'Password is required to access AWS credentials',
      });
      return;
    }

    const user = await User.findById(userId).select(
      '+password +awsAccessKeyId +awsSecretAccessKey prizeversityUserId prizeversityClassroomId'
    );
    if (!user) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    if (!hasPrizeversityChallengeLink(user)) {
      res.status(403).json({
        error: 'Link your Prizeversity account before accessing AWS challenge credentials',
      });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        error: 'Invalid password',
      });
      return;
    }

    if (!user.awsAccessKeyId || !user.awsSecretAccessKey) {
      res.status(404).json({
        error: 'AWS credentials not found for this account',
      });
      return;
    }

    user.hasViewedAwsCredentials = true;
    await user.save();

    res.json({
      success: true,
      awsCredentials: {
        accessKeyId: user.awsAccessKeyId,
        secretAccessKey: user.awsSecretAccessKey,
      },
    });
  } catch (error: unknown) {
    log.error('get aws credentials error.', error);
    res.status(500).json({
      error: 'Server error while retrieving AWS credentials',
    });
  }
};

export const markAwsCredentialsViewed = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    user.hasViewedAwsCredentials = true;
    await user.save();

    res.json({
      success: true,
      message: 'AWS credentials marked as viewed',
    });
  } catch (error: unknown) {
    log.error('mark aws credentials viewed error.', error);
    res.status(500).json({
      error: 'Server error while updating credentials status',
    });
  }
};
