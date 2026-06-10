declare global {
  namespace Express {
    type UserRole = 'member' | 'moderator' | 'admin' | 'superuser';
    type UserStatus = 'active' | 'banned' | 'suspended';

    interface UserPayload {
      id: string;
      email?: string;
      tokenVersion?: number;
      role?: UserRole;
      status?: UserStatus;
    }

    interface TargetUserPayload {
      role?: UserRole;
      [key: string]: unknown;
    }

    interface Request {
      user?: UserPayload;
      targetUser?: TargetUserPayload;
    }
  }
}

export {};
