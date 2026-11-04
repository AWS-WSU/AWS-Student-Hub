import env from '../config/env';
import logger from '../config/logger';
import Broadcast from '../models/Broadcast';
import type { IBroadcast, IBroadcastDocument } from '../models/Broadcast';
import BroadcastDelivery from '../models/BroadcastDelivery';
import type { IBroadcastDeliveryDocument } from '../models/BroadcastDelivery';
import User from '../models/User';
import { builderWarsBroadcast } from './broadcasts/builderWarsEmail';
import type { BroadcastDefinition } from './broadcasts/types';
import { sendRawMail } from './emailService';

const log = logger.child({ module: 'broadcastService' });

const DEFINITIONS: Record<string, BroadcastDefinition> = {
  [builderWarsBroadcast.key]: builderWarsBroadcast,
};

/** A `processing` row older than this is assumed orphaned by a dead invocation. */
const STALE_PROCESSING_MS = 2 * 60 * 1000;
const DELAY_BETWEEN_SENDS_MS = 100;
const RETRY_DELAYS_SECONDS = [60, 300, 900, 3600];

export class BroadcastNotFoundError extends Error {
  constructor(key: string) {
    super(`Unknown broadcast "${key}"`);
    this.name = 'BroadcastNotFoundError';
  }
}

export class BroadcastAlreadySentError extends Error {
  constructor(key: string) {
    super(`Broadcast "${key}" has already been sent`);
    this.name = 'BroadcastAlreadySentError';
  }
}

export interface BroadcastCounts {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}

export interface BroadcastStatusView {
  definition: Pick<BroadcastDefinition, 'key' | 'title' | 'subject'>;
  broadcast: (Omit<IBroadcast, 'triggeredBy'> & { id: string; triggeredBy: string }) | null;
  counts: BroadcastCounts;
  eligibleRecipients: number;
}

export interface ProcessOptions {
  /** Wall-clock budget. Processing stops once this is exhausted. */
  budgetMs: number;
  /** Hard cap on rows handled in one call, regardless of budget. */
  maxDeliveries?: number;
}

export interface ProcessResults {
  processed: number;
  sent: number;
  failed: number;
  permanentlyFailed: number;
  remaining: number;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const nextRetryAt = (attempts: number): Date => {
  const seconds = RETRY_DELAYS_SECONDS[Math.min(attempts - 1, RETRY_DELAYS_SECONDS.length - 1)];
  return new Date(Date.now() + seconds * 1000);
};

export const getBroadcastDefinition = (key: string): BroadcastDefinition => {
  const definition = DEFINITIONS[key];
  if (!definition) {
    throw new BroadcastNotFoundError(key);
  }
  return definition;
};

export const listBroadcastKeys = (): string[] => Object.keys(DEFINITIONS);

const countEligibleRecipients = (): Promise<number> =>
  User.countDocuments({ status: 'active', email: { $exists: true, $ne: '' } });

const getCounts = async (key: string): Promise<BroadcastCounts> => {
  const rows = await BroadcastDelivery.aggregate<{ _id: string; count: number }>([
    { $match: { broadcastKey: key } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts: BroadcastCounts = { pending: 0, processing: 0, sent: 0, failed: 0, total: 0 };
  for (const row of rows) {
    if (row._id in counts) {
      counts[row._id as keyof Omit<BroadcastCounts, 'total'>] = row.count;
    }
    counts.total += row.count;
  }
  return counts;
};

const toView = (doc: IBroadcastDocument | null) => {
  if (!doc) return null;
  const plain = doc.toObject();
  return {
    ...plain,
    id: String(plain._id),
    triggeredBy: String(plain.triggeredBy),
  };
};

export const getBroadcastStatus = async (key: string): Promise<BroadcastStatusView> => {
  const definition = getBroadcastDefinition(key);

  const [broadcast, counts, eligibleRecipients] = await Promise.all([
    Broadcast.findOne({ key }),
    getCounts(key),
    countEligibleRecipients(),
  ]);

  return {
    definition: { key: definition.key, title: definition.title, subject: definition.subject },
    broadcast: toView(broadcast),
    counts,
    eligibleRecipients,
  };
};

/**
 * Folds delivery counts back onto the Broadcast row and flips it to
 * `completed` once nothing is left to send.
 */
const reconcileBroadcast = async (key: string): Promise<BroadcastCounts> => {
  const counts = await getCounts(key);
  const finished = counts.pending === 0 && counts.processing === 0;

  await Broadcast.updateOne(
    { key },
    {
      $set: {
        sentCount: counts.sent,
        failedCount: counts.failed,
        ...(finished ? { status: 'completed', completedAt: new Date() } : {}),
      },
    }
  );

  return counts;
};

const claimNextDelivery = async (key: string): Promise<IBroadcastDeliveryDocument | null> => {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

  return BroadcastDelivery.findOneAndUpdate(
    {
      broadcastKey: key,
      $or: [
        { status: 'pending', nextAttempt: { $lte: now } },
        { status: 'processing', lastAttempt: { $lte: staleBefore } },
      ],
    },
    { $set: { status: 'processing', lastAttempt: now } },
    { sort: { nextAttempt: 1 }, new: true }
  );
};

const sendDelivery = async (
  definition: BroadcastDefinition,
  delivery: IBroadcastDeliveryDocument
): Promise<void> => {
  const recipient = { email: delivery.email, fullName: delivery.fullName };
  await sendRawMail({
    from: `"${definition.fromName}" <${env.SMTP_USER}>`,
    to: delivery.email,
    subject: definition.subject,
    html: definition.buildHtml(recipient),
    text: definition.buildText(recipient),
  });
};

/**
 * Sends as many pending deliveries for `key` as fit in the budget. Safe to
 * call from several invocations at once: each row is claimed atomically.
 */
export const processBroadcastDeliveries = async (
  key: string,
  options: ProcessOptions
): Promise<ProcessResults> => {
  const definition = getBroadcastDefinition(key);
  const deadline = Date.now() + options.budgetMs;
  const maxDeliveries = options.maxDeliveries ?? Number.POSITIVE_INFINITY;

  const results: ProcessResults = {
    processed: 0,
    sent: 0,
    failed: 0,
    permanentlyFailed: 0,
    remaining: 0,
  };

  while (results.processed < maxDeliveries && Date.now() < deadline) {
    const delivery = await claimNextDelivery(key);
    if (!delivery) break;

    results.processed++;
    delivery.attempts += 1;

    try {
      await sendDelivery(definition, delivery);
      delivery.status = 'sent';
      delivery.sentAt = new Date();
      delivery.lastError = undefined;
      results.sent++;
    } catch (error: unknown) {
      delivery.lastError = getErrorMessage(error);
      if (delivery.attempts >= delivery.maxAttempts) {
        delivery.status = 'failed';
        results.permanentlyFailed++;
        log.error(`broadcast ${key}: ${delivery.email} failed permanently.`, error);
      } else {
        delivery.status = 'pending';
        delivery.nextAttempt = nextRetryAt(delivery.attempts);
        results.failed++;
        log.warn(`broadcast ${key}: ${delivery.email} failed, retrying later.`, error);
      }
    }

    await delivery.save();
    await sleep(DELAY_BETWEEN_SENDS_MS);
  }

  const counts = await reconcileBroadcast(key);
  results.remaining = counts.pending + counts.processing;
  return results;
};

/** Runs a budgeted pass over every broadcast that still has work. Used by the scheduler. */
export const processAllBroadcasts = async (
  options: ProcessOptions
): Promise<Record<string, ProcessResults>> => {
  const active = await Broadcast.find({ status: 'sending' }).select('key');
  const summary: Record<string, ProcessResults> = {};
  const deadline = Date.now() + options.budgetMs;

  for (const row of active) {
    const budgetMs = deadline - Date.now();
    if (budgetMs <= 0) break;
    summary[row.key] = await processBroadcastDeliveries(row.key, { ...options, budgetMs });
  }

  return summary;
};

/**
 * Claims the broadcast key, enqueues every active member, and sends as many
 * as fit in the budget. Throws BroadcastAlreadySentError if the key is taken.
 */
export const startBroadcast = async (
  key: string,
  admin: { id: string; email: string },
  options: ProcessOptions
): Promise<{ status: BroadcastStatusView; results: ProcessResults }> => {
  const definition = getBroadcastDefinition(key);

  let broadcast;
  try {
    broadcast = await Broadcast.create({
      key: definition.key,
      status: 'sending',
      triggeredBy: admin.id,
      triggeredByEmail: admin.email,
      startedAt: new Date(),
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      throw new BroadcastAlreadySentError(key);
    }
    throw error;
  }

  try {
    const users = await User.find({ status: 'active', email: { $exists: true, $ne: '' } })
      .select('email fullName')
      .lean();

    if (users.length > 0) {
      await BroadcastDelivery.insertMany(
        users.map((user) => ({
          broadcastKey: key,
          email: user.email,
          fullName: user.fullName || '',
          status: 'pending',
          nextAttempt: new Date(),
        })),
        { ordered: false }
      );
    }

    broadcast.recipientCount = users.length;
    await broadcast.save();

    log.info(`broadcast ${key} started by ${admin.email} for ${users.length} recipients.`);
  } catch (error: unknown) {
    // Nothing has been emailed yet, so release the key rather than burn the one shot.
    log.error(`broadcast ${key} failed before sending, releasing key.`, error);
    await Promise.all([
      BroadcastDelivery.deleteMany({ broadcastKey: key }),
      Broadcast.deleteOne({ _id: broadcast._id }),
    ]);
    throw error;
  }

  const results = await processBroadcastDeliveries(key, options);
  const status = await getBroadcastStatus(key);
  return { status, results };
};
