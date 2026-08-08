import type { User } from './user';

export type ProfileUpdatePayload = Partial<User> & Record<string, unknown>;

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  rememberMe: boolean;
  user: User;
  awsCredentials?: AwsCredentials;
}

export interface LoginCredentials {
  email: string;
  password: string;
  deviceId?: string;
  rememberMe?: boolean;
  acceptedPolicies?: boolean;
}

export interface SignupPayload {
  username?: string;
  fullName: string;
  email: string;
  password: string;
  deviceId?: string;
  rememberMe?: boolean;
  acceptedPolicies?: boolean;
}

export interface Auth0ExchangePayload {
  idToken: string;
  deviceId: string;
  rememberMe: boolean;
  acceptedPolicies: boolean;
}

export class PolicyAcknowledgementRequiredError extends Error {
  readonly policyVersion?: string;

  constructor(message: string, policyVersion?: string) {
    super(message);
    this.name = 'PolicyAcknowledgementRequiredError';
    this.policyVersion = policyVersion;
  }
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  signup: (payload: SignupPayload) => Promise<AuthResponse>;
  logout: (allDevices?: boolean) => Promise<void>;
  updateUser: (updateData: ProfileUpdatePayload) => Promise<{ user: User; [key: string]: unknown }>;
  uploadProfilePicture: (file: File | Blob) => Promise<Record<string, unknown>>;
  refreshTokens: () => Promise<AuthResponse | void>;
  forceLogoutAndClearData: () => void;
  getAwsCredentials: (password: string) => Promise<AwsCredentials>;
  markAwsCredentialsViewed: () => Promise<Record<string, unknown>>;
  isAuthenticated: boolean;
  authError: string | null;
}
