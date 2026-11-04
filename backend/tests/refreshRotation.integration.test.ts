/**
 * Exercises refresh-token rotation against a real MongoDB, because the whole
 * point is the atomicity of the update. Skipped unless MONGO_TEST_URI is set:
 *
 *   docker run -d --rm -p 27099:27017 mongo:7
 *   MONGO_TEST_URI=mongodb://localhost:27099/hub-auth-test bun test tests/refreshRotation.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import mongoose from 'mongoose';

const uri = process.env.MONGO_TEST_URI;

describe.skipIf(!uri)('refresh token rotation (integration)', () => {
  let User: typeof import('../src/models/User').default;
  let service: typeof import('../src/services/refreshTokenService');
  let userId: mongoose.Types.ObjectId;
  const deviceId = 'laptop';

  beforeAll(async () => {
    await mongoose.connect(uri as string);
    User = (await import('../src/models/User')).default;
    service = await import('../src/services/refreshTokenService');
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await User.create({
      username: 'ada',
      fullName: 'Ada Lovelace',
      email: 'ada@wayne.edu',
      password: 'correct horse battery staple',
    });
    userId = user._id;
  });

  const seed = async (rememberMe = true) => {
    const entry = service.buildRefreshTokenEntry(deviceId, rememberMe);
    await User.updateOne({ _id: userId }, { $set: { refreshTokens: [entry] } });
    return entry;
  };

  const tokensOf = async () => (await User.findById(userId))?.refreshTokens ?? [];

  it('rotates once and keeps the old token answerable for the grace window', async () => {
    const old = await seed();
    const replacement = service.buildRefreshTokenEntry(deviceId, true);

    expect(await service.rotateRefreshToken(userId, old.token, deviceId, replacement)).toBe(true);

    const tokens = await tokensOf();
    expect(tokens.map((t) => t.token).sort()).toEqual([old.token, replacement.token].sort());
    const rotated = tokens.find((t) => t.token === old.token);
    expect(rotated?.replacedBy).toBe(replacement.token);

    const again = service.resolveRefreshToken(tokens, old.token, deviceId);
    expect(again.kind).toBe('replay');
  });

  it('lets exactly one of many concurrent refreshes win, and the rest replay the winner', async () => {
    const old = await seed();
    const attempts = Array.from({ length: 8 }, () =>
      service.buildRefreshTokenEntry(deviceId, true)
    );

    const outcomes = await Promise.all(
      attempts.map((replacement) =>
        service.rotateRefreshToken(userId, old.token, deviceId, replacement)
      )
    );

    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const winner = attempts[outcomes.indexOf(true)];

    const tokens = await tokensOf();
    expect(tokens).toHaveLength(2);
    const replay = service.resolveRefreshToken(tokens, old.token, deviceId);
    expect(replay.kind).toBe('replay');
    if (replay.kind === 'replay') expect(replay.replacement.token).toBe(winner.token);
  });

  it('prunes expired tokens and stale rotations during rotation', async () => {
    const old = await seed();
    const expired = {
      ...service.buildRefreshTokenEntry('phone', false),
      expiresAt: new Date(Date.now() - 1000),
    };
    const staleRotated = {
      ...service.buildRefreshTokenEntry('tablet', false),
      replacedBy: 'gone',
      rotatedAt: new Date(Date.now() - service.REFRESH_ROTATION_GRACE_MS - 5000),
    };
    await User.updateOne(
      { _id: userId },
      { $set: { refreshTokens: [old, expired, staleRotated] } }
    );

    const replacement = service.buildRefreshTokenEntry(deviceId, true);
    expect(await service.rotateRefreshToken(userId, old.token, deviceId, replacement)).toBe(true);

    const tokens = await tokensOf();
    expect(tokens.map((t) => t.token).sort()).toEqual([old.token, replacement.token].sort());
  });

  it('refuses to rotate a token that was already rotated', async () => {
    const old = await seed();
    const first = service.buildRefreshTokenEntry(deviceId, true);
    const second = service.buildRefreshTokenEntry(deviceId, true);

    expect(await service.rotateRefreshToken(userId, old.token, deviceId, first)).toBe(true);
    expect(await service.rotateRefreshToken(userId, old.token, deviceId, second)).toBe(false);
  });

  it('logout revokes a rotated token together with its replacement', async () => {
    const old = await seed();
    const replacement = service.buildRefreshTokenEntry(deviceId, true);
    await service.rotateRefreshToken(userId, old.token, deviceId, replacement);

    const user = await User.findById(userId);
    user?.revokeRefreshToken(old.token);
    await user?.save();

    expect(await tokensOf()).toHaveLength(0);
  });

  it('the model validator rejects rotated tokens for direct use', async () => {
    const old = await seed();
    const replacement = service.buildRefreshTokenEntry(deviceId, true);
    await service.rotateRefreshToken(userId, old.token, deviceId, replacement);

    const user = await User.findById(userId);
    expect(user?.validateRefreshToken(old.token, deviceId)).toBe(false);
    expect(user?.validateRefreshToken(replacement.token, deviceId)).toBe(true);
  });
});
