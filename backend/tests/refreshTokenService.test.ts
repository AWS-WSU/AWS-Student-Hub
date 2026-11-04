import { describe, expect, it } from 'bun:test';

import type { RefreshTokenEntry } from '../src/models/User';
import {
  REFRESH_ROTATION_GRACE_MS,
  buildRefreshTokenEntry,
  inferRememberMe,
  resolveRefreshToken,
} from '../src/services/refreshTokenService';

const now = new Date('2026-11-04T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const entry = (overrides: Partial<RefreshTokenEntry> = {}): RefreshTokenEntry => ({
  token: 'old',
  createdAt: new Date(now.getTime() - DAY),
  expiresAt: new Date(now.getTime() + 6 * DAY),
  deviceId: 'dev-1',
  rememberMe: false,
  ...overrides,
});

describe('buildRefreshTokenEntry', () => {
  it('issues 30 days when remembered and 7 otherwise', () => {
    const remembered = buildRefreshTokenEntry('dev-1', true, now);
    const standard = buildRefreshTokenEntry('dev-1', false, now);
    expect(remembered.expiresAt.getTime() - now.getTime()).toBe(30 * DAY);
    expect(standard.expiresAt.getTime() - now.getTime()).toBe(7 * DAY);
    expect(remembered.token).not.toBe(standard.token);
    expect(remembered.token).toHaveLength(128);
  });
});

describe('inferRememberMe', () => {
  it('uses the stored flag when present', () => {
    expect(inferRememberMe(entry({ rememberMe: true }), now)).toBe(true);
    expect(inferRememberMe(entry({ rememberMe: false }), now)).toBe(false);
  });

  it('falls back to the lifetime for legacy tokens without the flag', () => {
    const legacyLong = entry({
      rememberMe: undefined,
      expiresAt: new Date(now.getTime() + 20 * DAY),
    });
    const legacyShort = entry({
      rememberMe: undefined,
      expiresAt: new Date(now.getTime() + 3 * DAY),
    });
    expect(inferRememberMe(legacyLong, now)).toBe(true);
    expect(inferRememberMe(legacyShort, now)).toBe(false);
  });
});

describe('resolveRefreshToken', () => {
  it('rejects unknown tokens and wrong devices', () => {
    expect(resolveRefreshToken([entry()], 'nope', 'dev-1', now)).toEqual({
      kind: 'invalid',
      reason: 'unknown',
    });
    expect(resolveRefreshToken([entry()], 'old', 'dev-2', now)).toEqual({
      kind: 'invalid',
      reason: 'unknown',
    });
    expect(resolveRefreshToken(undefined, 'old', 'dev-1', now).kind).toBe('invalid');
  });

  it('rejects expired tokens', () => {
    const expired = entry({ expiresAt: new Date(now.getTime() - 1) });
    expect(resolveRefreshToken([expired], 'old', 'dev-1', now)).toEqual({
      kind: 'invalid',
      reason: 'expired',
    });
  });

  it('rotates a live, unused token', () => {
    const result = resolveRefreshToken([entry()], 'old', 'dev-1', now);
    expect(result.kind).toBe('rotate');
  });

  it('replays the replacement inside the grace window', () => {
    const replacement = entry({ token: 'new', createdAt: now });
    const rotated = entry({
      replacedBy: 'new',
      rotatedAt: new Date(now.getTime() - REFRESH_ROTATION_GRACE_MS / 2),
    });
    const result = resolveRefreshToken([rotated, replacement], 'old', 'dev-1', now);
    expect(result.kind).toBe('replay');
    if (result.kind === 'replay') expect(result.replacement.token).toBe('new');
  });

  it('rejects a rotated token once the grace window has passed', () => {
    const replacement = entry({ token: 'new', createdAt: now });
    const rotated = entry({
      replacedBy: 'new',
      rotatedAt: new Date(now.getTime() - REFRESH_ROTATION_GRACE_MS - 1),
    });
    expect(resolveRefreshToken([rotated, replacement], 'old', 'dev-1', now)).toEqual({
      kind: 'invalid',
      reason: 'rotated',
    });
  });

  it('rejects a rotated token whose replacement is gone or expired', () => {
    const rotated = entry({ replacedBy: 'new', rotatedAt: now });
    expect(resolveRefreshToken([rotated], 'old', 'dev-1', now).kind).toBe('invalid');

    const deadReplacement = entry({ token: 'new', expiresAt: new Date(now.getTime() - 1) });
    expect(resolveRefreshToken([rotated, deadReplacement], 'old', 'dev-1', now).kind).toBe(
      'invalid'
    );
  });

  it('accepts ISO strings for dates, as raw Mongo rows may carry', () => {
    const raw = {
      ...entry(),
      expiresAt: new Date(now.getTime() + DAY).toISOString(),
    } as unknown as RefreshTokenEntry;
    expect(resolveRefreshToken([raw], 'old', 'dev-1', now).kind).toBe('rotate');
  });
});
