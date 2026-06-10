import type { User } from './user';

export interface AdminStats {
  totalUsers?: number;
  activeUsers?: number;
  bannedUsers?: number;
  suspendedUsers?: number;
  adminUsers?: number;
  moderatorUsers?: number;
  recentSignups?: number;
  totalEvents?: number;
  publishedEvents?: number;
  draftEvents?: number;
  [key: string]: unknown;
}

export interface AdminUser extends User {
  tokenVersion?: number;
  metadata?: Record<string, unknown>;
}

export interface EmailQueueEntry {
  _id?: string;
  id?: string;
  to?: string;
  recipient?: string;
  subject?: string;
  status?: string;
  type?: string;
  attempts?: number;
  createdAt?: string;
  updatedAt?: string;
  sentAt?: string;
  error?: string;
  [key: string]: unknown;
}
