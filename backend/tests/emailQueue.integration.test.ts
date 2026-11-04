/**
 * Runs against a real MongoDB so the atomic-claim guarantees are actually
 * exercised. Skipped unless MONGO_TEST_URI is set, e.g.
 *
 *   docker run -d --rm -p 27099:27017 mongo:7
 *   MONGO_TEST_URI=mongodb://localhost:27099/hub-queue-test bun test tests/emailQueue.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import mongoose from 'mongoose';

const uri = process.env.MONGO_TEST_URI;

// Everything emailService sends goes through this stub.
type SendMailOptions = { to: string; subject: string; html: string };
const sent: SendMailOptions[] = [];
const failures = new Map<string, unknown>();
let sendDelayMs = 0;

const sendMail = async (options: SendMailOptions) => {
  if (sendDelayMs) await new Promise((resolve) => setTimeout(resolve, sendDelayMs));
  const failure = failures.get(options.to);
  if (failure) {
    throw failure;
  }
  sent.push(options);
  return { messageId: `stub-${sent.length}` };
};

mock.module('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
  createTransport: () => ({ sendMail }),
}));

const smtpError = (responseCode: number, message: string) =>
  Object.assign(new Error(message), { responseCode });

describe.skipIf(!uri)('event email queue (integration)', () => {
  let EmailQueue: typeof import('../src/models/EmailQueue').default;
  let service: typeof import('../src/services/emailService');

  const event = {
    _id: new mongoose.Types.ObjectId(),
    title: 'Builder Wars kickoff',
    startTime: new Date('2026-11-14T15:00:00Z'),
    isRemote: false,
    locationName: 'Newlab Detroit',
  };

  const users = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      email: `member${i}@wayne.edu`,
      fullName: `Member ${i}`,
    }));

  beforeAll(async () => {
    await mongoose.connect(uri as string);
    EmailQueue = (await import('../src/models/EmailQueue')).default;
    service = await import('../src/services/emailService');
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await EmailQueue.deleteMany({});
    await EmailQueue.syncIndexes();
    sent.length = 0;
    failures.clear();
    sendDelayMs = 0;
  });

  it('queues everyone first, then sends exactly once each', async () => {
    const result = await service.sendBulkEventNotification(users(12), event, 'Bring a laptop', {
      budgetMs: 10_000,
    });

    expect(result.queued).toBe(12);
    expect(result.sent).toBe(12);
    expect(result.remaining).toBe(0);
    expect(sent.map((m) => m.to).sort()).toEqual(
      users(12)
        .map((u) => u.email)
        .sort()
    );
    expect(await EmailQueue.countDocuments({ status: 'completed' })).toBe(12);
  });

  it('carries the custom message into queued sends', async () => {
    await service.enqueueEventNotifications(users(1), event, 'Pizza provided.');
    await service.processEmailQueue({ budgetMs: 5_000 });

    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain('Pizza provided.');
  });

  it('is idempotent: re-notifying skips existing rows and reopens failed ones', async () => {
    const first = await service.enqueueEventNotifications(users(5), event);
    expect(first).toEqual({ queued: 5, skipped: 0, reopened: 0 });

    await EmailQueue.updateOne(
      { email: 'member0@wayne.edu' },
      { $set: { status: 'failed', attempts: 5, lastError: 'nope' } }
    );

    const again = await service.enqueueEventNotifications(users(7), event);
    expect(again).toEqual({ queued: 2, skipped: 5, reopened: 1 });

    const reopened = await EmailQueue.findOne({ email: 'member0@wayne.edu' });
    expect(reopened?.status).toBe('pending');
    expect(reopened?.attempts).toBe(0);
    expect(reopened?.lastError).toBeUndefined();
  });

  it('never double-sends when two invocations drain the queue concurrently', async () => {
    await service.enqueueEventNotifications(users(30), event);
    sendDelayMs = 5;

    const [a, b, c] = await Promise.all([
      service.processEmailQueue({ budgetMs: 10_000 }),
      service.processEmailQueue({ budgetMs: 10_000 }),
      service.processEmailQueue({ budgetMs: 10_000 }),
    ]);

    expect(a.succeeded + b.succeeded + c.succeeded).toBe(30);
    expect(sent).toHaveLength(30);
    expect(new Set(sent.map((m) => m.to)).size).toBe(30);
    expect(await EmailQueue.countDocuments({ status: { $ne: 'completed' } })).toBe(0);
  });

  it('respects the wall-clock budget and reports what is left', async () => {
    await service.enqueueEventNotifications(users(20), event);
    sendDelayMs = 60;

    const result = await service.processEmailQueue({ budgetMs: 300 });

    expect(result.succeeded).toBeGreaterThan(0);
    expect(result.succeeded).toBeLessThan(20);
    expect(result.remaining).toBe(20 - result.succeeded);
  });

  it('reclaims rows orphaned in processing by a dead invocation', async () => {
    await service.enqueueEventNotifications(users(1), event);
    await EmailQueue.updateOne(
      { email: 'member0@wayne.edu' },
      { $set: { status: 'processing', lastAttempt: new Date(Date.now() - 3 * 60 * 1000) } }
    );

    const result = await service.processEmailQueue({ budgetMs: 5_000 });
    expect(result.succeeded).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('leaves a row another invocation is actively sending alone', async () => {
    await service.enqueueEventNotifications(users(1), event);
    await EmailQueue.updateOne(
      { email: 'member0@wayne.edu' },
      { $set: { status: 'processing', lastAttempt: new Date() } }
    );

    const result = await service.processEmailQueue({ budgetMs: 2_000 });
    expect(result.processed).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('schedules a retry on a permanent rejection and fails after maxAttempts', async () => {
    await service.enqueueEventNotifications(users(1), event);
    failures.set('member0@wayne.edu', smtpError(550, '550 5.1.1 account does not exist'));

    const first = await service.processEmailQueue({ budgetMs: 5_000 });
    expect(first.failed).toBe(1);

    const row = await EmailQueue.findOne({ email: 'member0@wayne.edu' });
    expect(row?.status).toBe('pending');
    expect(row?.attempts).toBe(1);
    expect(row?.nextAttempt.getTime()).toBeGreaterThan(Date.now() + 30_000);
    expect(row?.lastError).toContain('5.1.1');

    // Exhaust the budget by making every retry due now.
    for (let i = 1; i < 5; i++) {
      await EmailQueue.updateOne({ _id: row?._id }, { $set: { nextAttempt: new Date(0) } });
      await service.processEmailQueue({ budgetMs: 5_000 });
    }
    const done = await EmailQueue.findOne({ email: 'member0@wayne.edu' });
    expect(done?.status).toBe('failed');
    expect(done?.attempts).toBe(5);
  });

  it('defers without charging an attempt when SMTP throttles, and stops the batch', async () => {
    await service.enqueueEventNotifications(users(5), event);
    failures.set('member0@wayne.edu', smtpError(421, '421 4.7.0 Try again later'));

    const result = await service.processEmailQueue({ budgetMs: 5_000 });

    expect(result.deferred).toBe(1);
    // The first claim hit the throttle and the loop broke; the rest are untouched.
    expect(result.processed).toBe(1);
    expect(sent).toHaveLength(0);

    const row = await EmailQueue.findOne({ email: 'member0@wayne.edu' });
    expect(row?.status).toBe('pending');
    expect(row?.attempts).toBe(0);
    expect(row?.nextAttempt.getTime()).toBeGreaterThan(Date.now() + 20 * 60 * 1000);
  });

  it('retryFailedEmail sends a failed row now with a fresh attempt budget', async () => {
    await service.enqueueEventNotifications(users(1), event);
    const row = await EmailQueue.findOne({ email: 'member0@wayne.edu' });
    await EmailQueue.updateOne({ _id: row?._id }, { $set: { status: 'failed', attempts: 5 } });

    const result = await service.retryFailedEmail(String(row?._id));

    expect(result.succeeded).toBe(1);
    const after = await EmailQueue.findById(row?._id);
    expect(after?.status).toBe('completed');
    expect(after?.attempts).toBe(1);
  });

  it('retryFailedEmail refuses completed rows and rows in active processing', async () => {
    await service.enqueueEventNotifications(users(2), event);
    const [a, b] = await EmailQueue.find({}).sort({ email: 1 });
    await EmailQueue.updateOne({ _id: a._id }, { $set: { status: 'completed' } });
    await EmailQueue.updateOne(
      { _id: b._id },
      { $set: { status: 'processing', lastAttempt: new Date() } }
    );

    await expect(service.retryFailedEmail(String(a._id))).rejects.toThrow('already sent');
    await expect(service.retryFailedEmail(String(b._id))).rejects.toThrow('another process');
  });
});
