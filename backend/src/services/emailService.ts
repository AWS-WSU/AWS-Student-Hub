import nodemailer from 'nodemailer';

import env from '../config/env';
import logger from '../config/logger';
import EmailQueue from '../models/EmailQueue';
import type { EmailEventSnapshot } from '../models/EmailQueue';

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

interface BulkEmailResults {
  sent: number;
  failed: number;
  queued: number;
  errors: Array<{ email: string; error: string }>;
}

interface QueueProcessingResults {
  processed: number;
  succeeded: number;
  failed: number;
  permanentlyFailed: number;
}

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
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
    from: `"AWS Cloud Club @ WSU" <${env.SMTP_USER}>`,
    to: email,
    subject: `🚀 New Event: ${event.title} - AWS Cloud Club`,
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
            <h1>☁️ AWS Cloud Club</h1>
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
            <p>AWS Cloud Club @ Wayne State University</p>
            <div class="social-links">
              <a href="https://discord.gg/KaQdmjGp">Discord</a> •
              <a href="https://www.instagram.com/awscloudclub.wsu">Instagram</a> •
              <a href="https://github.com/awsccwsu">GitHub</a>
            </div>
            <p class="unsubscribe">
              You're receiving this because you're a registered member of AWS Cloud Club.<br>
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

const getNextRetryTime = (attempts: number): Date => {
  const delays = [60, 300, 900, 3600, 14400];
  const delaySeconds = delays[Math.min(attempts, delays.length - 1)];
  return new Date(Date.now() + delaySeconds * 1000);
};

const createEventSnapshot = (event: EventNotificationData): EmailEventSnapshot => ({
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
});

const queueFailedEmail = async (
  email: string,
  fullName: string,
  event: EventNotificationData,
  error: unknown
): Promise<void> => {
  try {
    await EmailQueue.findOneAndUpdate(
      { email, eventId: event._id },
      {
        email,
        fullName,
        eventId: event._id,
        eventSnapshot: createEventSnapshot(event),
        status: 'pending',
        $inc: { attempts: 1 },
        lastAttempt: new Date(),
        lastError: getErrorMessage(error),
        nextAttempt: getNextRetryTime(1),
      },
      { upsert: true, new: true }
    );
    log.info(`queued failed email for retry ${email}.`);
  } catch (queueError: unknown) {
    log.error(`failed to queue email for ${email}.`, queueError);
  }
};

export const sendBulkEventNotification = async (
  users: EmailRecipient[],
  event: EventNotificationData,
  customMessage = ''
): Promise<BulkEmailResults> => {
  const results: BulkEmailResults = {
    sent: 0,
    failed: 0,
    queued: 0,
    errors: [],
  };

  for (const user of users) {
    try {
      await sendEventNotification(user.email, user.fullName, event, customMessage);
      results.sent++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error: unknown) {
      results.failed++;
      results.errors.push({ email: user.email, error: getErrorMessage(error) });
      await queueFailedEmail(user.email, user.fullName, event, error);
      results.queued++;
    }
  }

  return results;
};

export const processEmailQueue = async (batchSize = 10): Promise<QueueProcessingResults> => {
  const results: QueueProcessingResults = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    permanentlyFailed: 0,
  };

  try {
    const pendingEmails = await EmailQueue.find({
      status: 'pending',
      nextAttempt: { $lte: new Date() },
    })
      .sort({ nextAttempt: 1 })
      .limit(batchSize);

    for (const queuedEmail of pendingEmails) {
      results.processed++;

      queuedEmail.status = 'processing';
      await queuedEmail.save();

      try {
        await sendEventNotification(
          queuedEmail.email,
          queuedEmail.fullName,
          queuedEmail.eventSnapshot as EventNotificationData
        );

        queuedEmail.status = 'completed';
        queuedEmail.completedAt = new Date();
        await queuedEmail.save();
        results.succeeded++;
        log.info(`successfully sent queued email to ${queuedEmail.email}.`);

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: unknown) {
        queuedEmail.attempts += 1;
        queuedEmail.lastAttempt = new Date();
        queuedEmail.lastError = getErrorMessage(error);

        if (queuedEmail.attempts >= queuedEmail.maxAttempts) {
          queuedEmail.status = 'failed';
          results.permanentlyFailed++;
          log.error(
            `email to ${queuedEmail.email} permanently failed after ${queuedEmail.attempts} attempts.`
          );
        } else {
          queuedEmail.status = 'pending';
          queuedEmail.nextAttempt = getNextRetryTime(queuedEmail.attempts);
          results.failed++;
          log.info(
            `email to ${queuedEmail.email} failed, retry scheduled for ${queuedEmail.nextAttempt}.`
          );
        }

        await queuedEmail.save();
      }
    }
  } catch (error: unknown) {
    log.error('error processing email queue.', error);
  }

  return results;
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
  const query = status ? { status } : {};
  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    EmailQueue.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        'email fullName eventId eventSnapshot.title status attempts lastAttempt nextAttempt lastError createdAt'
      ),
    EmailQueue.countDocuments(query),
  ]);

  return {
    entries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const retryFailedEmail = async (queueId: string): Promise<QueueProcessingResults> => {
  const queuedEmail = await EmailQueue.findById(queueId);
  if (!queuedEmail) {
    throw new Error('Queue entry not found');
  }

  if (queuedEmail.status !== 'failed' && queuedEmail.status !== 'pending') {
    throw new Error('Email is not in a retryable state');
  }

  queuedEmail.status = 'pending';
  queuedEmail.nextAttempt = new Date();
  await queuedEmail.save();

  return processEmailQueue(1);
};
