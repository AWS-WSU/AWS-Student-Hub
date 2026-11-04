import nodemailer from 'nodemailer';

import env from '../config/env';
import logger from '../config/logger';
import EmailQueue from '../models/EmailQueue';
import type { EmailEventSnapshot, IEmailQueueDocument } from '../models/EmailQueue';
import { classifyTransientSmtpError, transientDeferMs } from './smtpErrors';

const log = logger.child({ module: 'emailService' });

interface EventNotificationData extends Omit<EmailEventSnapshot, 'startTime' | 'isRemote'> {
  _id?: unknown;
  title: string;
  startTime: Date | string;
  isRemote?: boolean | string;
}

interface EmailRecipient {
  email: string;
  fullName: string;
}

export interface BulkEmailResults {
  /** Rows created for this call. */
  queued: number;
  /** Recipients that already had a row for this event. */
  skipped: number;
  /** Sent inside this call's budget. */
  sent: number;
  /** Failed inside this call's budget (retry scheduled or permanently failed). */
  failed: number;
  /** Deferred because SMTP is throttling. */
  deferred: number;
  /** Rows still pending or processing across the whole queue. */
  remaining: number;
}

export interface QueueProcessingResults {
  processed: number;
  succeeded: number;
  failed: number;
  deferred: number;
  permanentlyFailed: number;
  remaining: number;
}

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  // One login per invocation instead of one per message, and no call can
  // hang long enough to eat a whole Lambda budget.
  pool: true,
  maxConnections: 1,
  maxMessages: 100,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

export interface RawMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/** Sends a fully-formed message through the shared transporter. */
export const sendRawMail = async (options: RawMailOptions): Promise<void> => {
  await transporter.sendMail({
    from: options.from ?? `"AWS Student Hub" <${env.SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
};

export const sendResetCode = async (
  email: string,
  code: string,
  fullName: string
): Promise<void> => {
  const mailOptions = {
    from: `"AWS Student Hub" <${env.SMTP_USER}>`,
    to: email,
    subject: 'Password Reset Code - AWS Student Hub',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .code-box { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .code { font-size: 32px; font-weight: bold; color: #FF9900; letter-spacing: 5px; }
          .footer { margin-top: 30px; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Password Reset Request</h2>
          </div>
          <p>Hello ${fullName},</p>
          <p>You requested to reset your password for your AWS Student Hub account. Use the code below to complete your password reset:</p>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <p>This code will expire in 10 minutes for security reasons.</p>
          <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
          <div class="footer">
            <p>Best regards,<br>AWS Student Hub Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendPrizeversityLinkCode = async (
  email: string,
  code: string,
  fullName: string,
  classroomName = 'your Prizeversity classroom'
): Promise<void> => {
  const mailOptions = {
    from: `"AWS Student Hub" <${env.SMTP_USER}>`,
    to: email,
    subject: 'Prizeversity Link Code - AWS Student Hub',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .code-box { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .code { font-size: 32px; font-weight: bold; color: #FF9900; letter-spacing: 5px; }
          .footer { margin-top: 30px; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Prizeversity Account Link</h2>
          </div>
          <p>Hello ${fullName || 'there'},</p>
          <p>AWS Student Hub received a request to link this Prizeversity account from ${classroomName} for challenge rewards.</p>
          <p>Use the code below to finish linking your account:</p>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this link, you can safely ignore this email.</p>
          <div class="footer">
            <p>Best regards,<br>AWS Student Hub Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendEventNotification = async (
  email: string,
  fullName: string,
  event: EventNotificationData,
  customMessage = ''
): Promise<void> => {
  const eventDate = new Date(event.startTime);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    timeZone: 'America/Detroit',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    timeZone: 'America/Detroit',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const isRemote = event.isRemote === true || event.isRemote === 'true';

  let locationHtml: string;
  if (isRemote) {
    locationHtml = `
      <div class="location-badge remote">
        <span class="badge-icon">🌐</span>
        <span>Remote Event</span>
      </div>
      ${
        event.zoomLink
          ? `
        <a href="${event.zoomLink}" class="join-button" target="_blank" rel="noopener">
          🔗 Join Webinar
        </a>
      `
          : '<p style="color: #666; font-style: italic;">Zoom link will be shared before the event</p>'
      }
    `;
  } else {
    locationHtml = `
      <div class="location-badge inperson">
        <span class="badge-icon">📍</span>
        <span>In-Person Event</span>
      </div>
      ${event.locationName ? `<p style="font-weight: 600; margin: 8px 0;">${event.locationName}</p>` : ''}
      ${event.address ? `<p style="color: #555; margin: 4px 0;">${event.address}</p>` : ''}
      ${event.directions ? `<p style="color: #777; font-size: 14px; margin-top: 8px; padding: 10px; background: #f8f9fa; border-radius: 6px;"><strong>Directions:</strong> ${event.directions}</p>` : ''}
    `;
  }

  const mailOptions = {
    from: `"AWS Student Builder Group @ WSU" <${env.SMTP_USER}>`,
    to: email,
    subject: `🚀 New Event: ${event.title} - AWS Student Builder Group`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #232f3e;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
          }
          .header {
            background: linear-gradient(135deg, #232f3e 0%, #37475a 100%);
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            color: #FF9900;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .header p {
            color: #ffffff;
            margin: 10px 0 0;
            font-size: 14px;
            opacity: 0.9;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            color: #232f3e;
            margin-bottom: 25px;
          }
          .event-card {
            background: linear-gradient(145deg, #fff9f0 0%, #ffffff 100%);
            border: 2px solid #FF9900;
            border-radius: 16px;
            padding: 30px;
            margin: 25px 0;
          }
          .event-title {
            font-size: 24px;
            font-weight: 700;
            color: #232f3e;
            margin: 0 0 20px;
            text-align: center;
          }
          .event-detail {
            display: flex;
            align-items: flex-start;
            margin: 15px 0;
            padding: 12px;
            background: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .detail-icon {
            font-size: 24px;
            margin-right: 15px;
            min-width: 30px;
          }
          .detail-content {
            flex: 1;
          }
          .detail-label {
            font-size: 12px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .detail-value {
            font-size: 16px;
            color: #232f3e;
            font-weight: 500;
          }
          .location-badge {
            display: inline-flex;
            align-items: center;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 12px;
          }
          .location-badge.remote {
            background: #e3f2fd;
            color: #1565c0;
          }
          .location-badge.inperson {
            background: #e8f5e9;
            color: #2e7d32;
          }
          .badge-icon {
            margin-right: 8px;
          }
          .description-box {
            background: #f8f9fa;
            border-left: 4px solid #FF9900;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 10px 10px 0;
          }
          .description-box h4 {
            margin: 0 0 10px;
            color: #232f3e;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .description-box p {
            margin: 0;
            color: #555;
            font-size: 15px;
          }
          .cta-section {
            text-align: center;
            margin: 30px 0;
          }
          .join-button {
            display: inline-block;
            background: linear-gradient(135deg, #FF9900 0%, #ffb84d 100%);
            color: #232f3e !important;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 30px;
            font-weight: 700;
            font-size: 16px;
            box-shadow: 0 4px 15px rgba(255, 153, 0, 0.4);
            transition: transform 0.2s;
          }
          .meetup-button {
            display: inline-block;
            background: #ED1C40;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 30px;
            font-weight: 700;
            font-size: 16px;
            margin-top: 15px;
          }
          ${
            event.thumbnailUrl
              ? `
          .event-image {
            width: 100%;
            height: auto;
            border-radius: 12px;
            margin-bottom: 25px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }
          `
              : ''
          }
          .footer {
            background: #232f3e;
            padding: 30px;
            text-align: center;
          }
          .footer p {
            color: #ffffff;
            margin: 0 0 10px;
            font-size: 14px;
          }
          .footer a {
            color: #FF9900;
            text-decoration: none;
          }
          .social-links {
            margin: 20px 0;
          }
          .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: #FF9900;
            text-decoration: none;
          }
          .unsubscribe {
            font-size: 12px;
            color: #888;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>☁️ AWS Student Builder Group</h1>
            <p>Wayne State University</p>
          </div>

          <div class="content">
            <p class="greeting">Hey ${fullName}! 👋</p>

            ${
              customMessage
                ? `
            <div class="description-box" style="margin-bottom: 25px;">
              <h4>💬 Message from the Team</h4>
              <p>${customMessage.replace(/\n/g, '<br>')}</p>
            </div>
            `
                : ''
            }

            <p>Great news! We have a new event coming up that you won't want to miss:</p>

            <div class="event-card">
              ${event.thumbnailUrl ? `<img src="${event.thumbnailUrl}" alt="${event.title}" class="event-image" />` : ''}

              <h2 class="event-title">${event.title}</h2>

              <div class="event-detail">
                <span class="detail-icon">📅</span>
                <div class="detail-content">
                  <div class="detail-label">Date</div>
                  <div class="detail-value">${formattedDate}</div>
                </div>
              </div>

              <div class="event-detail">
                <span class="detail-icon">⏰</span>
                <div class="detail-content">
                  <div class="detail-label">Time</div>
                  <div class="detail-value">${formattedTime}</div>
                </div>
              </div>

              <div class="event-detail">
                <span class="detail-icon">📍</span>
                <div class="detail-content">
                  <div class="detail-label">Location</div>
                  <div class="detail-value">
                    ${locationHtml}
                  </div>
                </div>
              </div>
            </div>

            ${
              event.description
                ? `
            <div class="description-box">
              <h4>📝 About This Event</h4>
              <p>${event.description}</p>
            </div>
            `
                : ''
            }

            <div class="cta-section">
              ${
                event.meetupUrl
                  ? `
                <a href="${event.meetupUrl}" class="meetup-button" target="_blank" rel="noopener">
                  📋 RSVP on Meetup
                </a>
              `
                  : ''
              }
            </div>

            <p style="color: #666; text-align: center; margin-top: 30px;">
              We can't wait to see you there! 🎉
            </p>
          </div>

          <div class="footer">
            <p>AWS Student Builder Group @ Wayne State University</p>
            <div class="social-links">
              <a href="https://discord.gg/KaQdmjGp">Discord</a> •
              <a href="https://www.instagram.com/aws_sbg_wsu/">Instagram</a> •
              <a href="https://github.com/awsccwsu">GitHub</a>
            </div>
            <p class="unsubscribe">
              You're receiving this because you're a registered member of AWS Student Builder Group.<br>
              Questions? Reply to this email or reach out on Discord.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

/* -------------------------------------------------------------------------- */
/* Event notification queue                                                    */
/*                                                                            */
/* The queue is the primary delivery path, not a fallback. Every recipient    */
/* gets a row first; sending happens in budgeted batches from whichever       */
/* invocation gets there (the notify request, the admin button, the 5-minute  */
/* schedule). Rows are claimed atomically so two invocations never send the   */
/* same email.                                                                */
/* -------------------------------------------------------------------------- */

const RETRY_DELAYS_SECONDS = [60, 300, 900, 3600, 14400];
/** A `processing` row older than this is assumed orphaned by a dead invocation. */
const STALE_PROCESSING_MS = 2 * 60 * 1000;
const DELAY_BETWEEN_SENDS_MS = 100;

export interface QueueProcessOptions {
  /** Wall-clock budget. Processing stops once this is exhausted. */
  budgetMs: number;
  /** Hard cap on rows handled in one call, regardless of budget. */
  maxEmails?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const getNextRetryTime = (attempts: number): Date => {
  const index = Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_SECONDS.length - 1);
  return new Date(Date.now() + RETRY_DELAYS_SECONDS[index] * 1000);
};

const createEventSnapshot = (
  event: EventNotificationData,
  customMessage = ''
): EmailEventSnapshot => ({
  title: event.title,
  startTime: new Date(event.startTime),
  isRemote: event.isRemote === true || event.isRemote === 'true',
  zoomLink: event.zoomLink || '',
  address: event.address || '',
  directions: event.directions || '',
  locationName: event.locationName || '',
  description: event.description || '',
  thumbnailUrl: event.thumbnailUrl || '',
  meetupUrl: event.meetupUrl || '',
  customMessage,
});

const countPending = (): Promise<number> =>
  EmailQueue.countDocuments({ status: { $in: ['pending', 'processing'] } });

/**
 * Creates one pending row per recipient. Safe to call again for the same
 * event: existing rows are left alone (the unique index rejects them) and
 * previously failed rows get a fresh retry budget.
 */
export const enqueueEventNotifications = async (
  users: EmailRecipient[],
  event: EventNotificationData,
  customMessage = ''
): Promise<{ queued: number; skipped: number; reopened: number }> => {
  if (users.length === 0) return { queued: 0, skipped: 0, reopened: 0 };

  const snapshot = createEventSnapshot(event, customMessage);
  const now = new Date();
  let queued: number;

  try {
    const inserted = await EmailQueue.insertMany(
      users.map((user) => ({
        email: user.email,
        fullName: user.fullName || '',
        eventId: event._id,
        eventSnapshot: snapshot,
        status: 'pending',
        attempts: 0,
        nextAttempt: now,
      })),
      { ordered: false }
    );
    queued = inserted.length;
  } catch (error: unknown) {
    // An unordered bulk write still inserts the non-conflicting rows. Duplicate
    // keys (code 11000) just mean the recipient already has a row for this event.
    const bulk = error as {
      insertedDocs?: unknown[];
      writeErrors?: Array<{ code?: number; err?: { code?: number } }>;
    };
    const writeErrors = Array.isArray(bulk.writeErrors) ? bulk.writeErrors : null;
    const nonDuplicate = (writeErrors ?? []).filter((e) => (e.code ?? e.err?.code) !== 11000);
    if (!writeErrors || !Array.isArray(bulk.insertedDocs) || nonDuplicate.length > 0) {
      throw error;
    }
    queued = bulk.insertedDocs.length;
  }

  const reopened = await EmailQueue.updateMany(
    { eventId: event._id, status: 'failed' },
    { $set: { status: 'pending', attempts: 0, nextAttempt: now }, $unset: { lastError: '' } }
  );

  return { queued, skipped: users.length - queued, reopened: reopened.modifiedCount };
};

const claimNextQueuedEmail = async (): Promise<IEmailQueueDocument | null> => {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

  return EmailQueue.findOneAndUpdate(
    {
      $or: [
        { status: 'pending', nextAttempt: { $lte: now } },
        { status: 'processing', lastAttempt: { $lte: staleBefore } },
      ],
    },
    { $set: { status: 'processing', lastAttempt: now }, $inc: { attempts: 1 } },
    { sort: { nextAttempt: 1 }, new: true }
  );
};

type DeliveryOutcome = 'sent' | 'retry' | 'deferred' | 'failed';

/**
 * Sends one claimed row and persists the result. The caller has already
 * moved it to `processing` and charged the attempt.
 */
const deliverQueuedEmail = async (queued: IEmailQueueDocument): Promise<DeliveryOutcome> => {
  try {
    await sendEventNotification(
      queued.email,
      queued.fullName,
      queued.eventSnapshot as EventNotificationData,
      queued.eventSnapshot?.customMessage ?? ''
    );
    queued.status = 'completed';
    queued.completedAt = new Date();
    queued.lastError = undefined;
    await queued.save();
    return 'sent';
  } catch (error: unknown) {
    queued.lastError = getErrorMessage(error);

    const transient = classifyTransientSmtpError(error);
    if (transient) {
      // Not the recipient's fault: hand the attempt back and try later.
      queued.status = 'pending';
      queued.attempts = Math.max(0, queued.attempts - 1);
      queued.nextAttempt = new Date(Date.now() + transientDeferMs(transient));
      await queued.save();
      log.warn(`email to ${queued.email} deferred (${transient}) until ${queued.nextAttempt}.`);
      return 'deferred';
    }

    if (queued.attempts >= queued.maxAttempts) {
      queued.status = 'failed';
      await queued.save();
      log.error(`email to ${queued.email} permanently failed after ${queued.attempts} attempts.`);
      return 'failed';
    }

    queued.status = 'pending';
    queued.nextAttempt = getNextRetryTime(queued.attempts);
    await queued.save();
    log.info(`email to ${queued.email} failed, retry scheduled for ${queued.nextAttempt}.`);
    return 'retry';
  }
};

/**
 * Sends as many due rows as fit in the budget. Safe to call from several
 * invocations at once. Stops early if SMTP is throttling us, since every
 * further send would just burn time.
 */
export const processEmailQueue = async (
  options: QueueProcessOptions
): Promise<QueueProcessingResults> => {
  const deadline = Date.now() + options.budgetMs;
  const maxEmails = options.maxEmails ?? Number.POSITIVE_INFINITY;

  const results: QueueProcessingResults = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    deferred: 0,
    permanentlyFailed: 0,
    remaining: 0,
  };

  try {
    while (results.processed < maxEmails && Date.now() < deadline) {
      const queued = await claimNextQueuedEmail();
      if (!queued) break;

      results.processed++;
      const outcome = await deliverQueuedEmail(queued);

      if (outcome === 'sent') results.succeeded++;
      else if (outcome === 'retry') results.failed++;
      else if (outcome === 'failed') results.permanentlyFailed++;
      else {
        results.deferred++;
        break;
      }

      await sleep(DELAY_BETWEEN_SENDS_MS);
    }
  } catch (error: unknown) {
    log.error('error processing email queue.', error);
  }

  results.remaining = await countPending();
  return results;
};

/**
 * Queues every recipient, then sends as many as the budget allows. Whatever
 * is left drains through the scheduler and the admin "process queue" button.
 */
export const sendBulkEventNotification = async (
  users: EmailRecipient[],
  event: EventNotificationData,
  customMessage = '',
  options: QueueProcessOptions = { budgetMs: 15_000 }
): Promise<BulkEmailResults> => {
  const { queued, skipped, reopened } = await enqueueEventNotifications(
    users,
    event,
    customMessage
  );
  log.info(
    `event ${String(event._id)}: queued ${queued}, skipped ${skipped} existing, reopened ${reopened} failed.`
  );

  const processed = await processEmailQueue(options);

  return {
    queued,
    skipped,
    sent: processed.succeeded,
    failed: processed.failed + processed.permanentlyFailed,
    deferred: processed.deferred,
    remaining: processed.remaining,
  };
};

export const getQueueStats = async () => {
  const [pending, processing, completed, failed] = await Promise.all([
    EmailQueue.countDocuments({ status: 'pending' }),
    EmailQueue.countDocuments({ status: 'processing' }),
    EmailQueue.countDocuments({ status: 'completed' }),
    EmailQueue.countDocuments({ status: 'failed' }),
  ]);

  const oldestPending = await EmailQueue.findOne({ status: 'pending' })
    .sort({ createdAt: 1 })
    .select('createdAt nextAttempt');

  return {
    pending,
    processing,
    completed,
    failed,
    total: pending + processing + completed + failed,
    oldestPending: oldestPending
      ? {
          createdAt: oldestPending.createdAt,
          nextAttempt: oldestPending.nextAttempt,
        }
      : null,
  };
};

export const getQueueEntries = async (status: string | null = null, page = 1, limit = 20) => {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
  const safePage = Math.max(Math.trunc(page) || 1, 1);
  const query = status ? { status } : {};
  const skip = (safePage - 1) * safeLimit;

  const [entries, total] = await Promise.all([
    EmailQueue.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .select(
        'email fullName eventId eventSnapshot.title status attempts lastAttempt nextAttempt lastError completedAt createdAt'
      ),
    EmailQueue.countDocuments(query),
  ]);

  return {
    entries,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

/**
 * Sends one specific row right now, regardless of its retry schedule. Failed
 * rows get a fresh attempt budget. A row another invocation is actively
 * sending is left alone.
 */
export const retryFailedEmail = async (queueId: string): Promise<QueueProcessingResults> => {
  const existing = await EmailQueue.findById(queueId).select('status');
  if (!existing) {
    throw new Error('Queue entry not found');
  }
  if (existing.status === 'completed') {
    throw new Error('Email was already sent');
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  const claimed = await EmailQueue.findOneAndUpdate(
    {
      _id: queueId,
      $or: [
        { status: { $in: ['pending', 'failed'] } },
        { status: 'processing', lastAttempt: { $lte: staleBefore } },
      ],
    },
    [
      {
        $set: {
          status: 'processing',
          lastAttempt: now,
          attempts: { $cond: [{ $eq: ['$status', 'failed'] }, 1, { $add: ['$attempts', 1] }] },
        },
      },
    ],
    { new: true }
  );

  if (!claimed) {
    throw new Error('Email is being sent by another process right now');
  }

  const outcome = await deliverQueuedEmail(claimed);
  return {
    processed: 1,
    succeeded: outcome === 'sent' ? 1 : 0,
    failed: outcome === 'retry' ? 1 : 0,
    deferred: outcome === 'deferred' ? 1 : 0,
    permanentlyFailed: outcome === 'failed' ? 1 : 0,
    remaining: await countPending(),
  };
};
