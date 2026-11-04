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
  completedAt?: string;
  lastAttempt?: string;
  nextAttempt?: string;
  lastError?: string;
  error?: string;
  [key: string]: unknown;
}

export type BroadcastRunStatus = 'sending' | 'completed' | 'failed';

export interface BroadcastCounts {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}

export interface BroadcastRecord {
  id: string;
  key: string;
  status: BroadcastRunStatus;
  triggeredBy: string;
  triggeredByEmail: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  startedAt: string;
  completedAt?: string;
  lastError?: string;
}

export interface BroadcastProcessResults {
  processed: number;
  sent: number;
  failed: number;
  permanentlyFailed: number;
  remaining: number;
}

export interface BroadcastStatusResponse {
  success: boolean;
  definition: { key: string; title: string; subject: string };
  broadcast: BroadcastRecord | null;
  counts: BroadcastCounts;
  eligibleRecipients: number;
  results?: BroadcastProcessResults;
}
