import crypto from 'node:crypto';

import { Types } from 'mongoose';

import User from '../models/User';
import type { RefreshTokenEntry } from '../models/User';

/**
 * Refresh tokens rotate on every use. A rotated token stays answerable for a
 * short grace window so that two tabs refreshing at the same moment both get
 * the same replacement instead of the loser being logged out.
 */
export const REFRESH_ROTATION_GRACE_MS = 60 * 1000;

const REMEMBERED_DAYS = 30;
const STANDARD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const buildRefreshTokenEntry = (
  deviceId: string,
  rememberMe: boolean,
  now = new Date()
): RefreshTokenEntry => ({
  token: crypto.randomBytes(64).toString('hex'),
  createdAt: now,
  expiresAt: new Date(now.getTime() + (rememberMe ? REMEMBERED_DAYS : STANDARD_DAYS) * DAY_MS),
  deviceId,
  rememberMe,
});

const asDate = (value: Date | string | undefined): Date | null => {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
};

/** Older tokens predate the flag; infer it from how long they were issued for. */
export const inferRememberMe = (entry: RefreshTokenEntry, now = new Date()): boolean => {
  if (typeof entry.rememberMe === 'boolean') return entry.rememberMe;
  const expiresAt = asDate(entry.expiresAt);
  return Boolean(expiresAt && expiresAt.getTime() - now.getTime() > STANDARD_DAYS * DAY_MS);
};

export type RefreshResolution =
  | { kind: 'rotate'; entry: RefreshTokenEntry }
  | { kind: 'replay'; entry: RefreshTokenEntry; replacement: RefreshTokenEntry }
  | { kind: 'invalid'; reason: 'unknown' | 'expired' | 'rotated' };

/**
 * Decides what a presented refresh token is entitled to. Pure, so it can be
 * unit tested and reused after a lost rotation race.
 */
export const resolveRefreshToken = (
  entries: RefreshTokenEntry[] | undefined,
  token: string,
  deviceId: string,
  now = new Date()
): RefreshResolution => {
  const list = Array.isArray(entries) ? entries : [];
  const entry = list.find((item) => item.token === token && item.deviceId === deviceId);
  if (!entry) return { kind: 'invalid', reason: 'unknown' };

  if (entry.replacedBy) {
    const rotatedAt = asDate(entry.rotatedAt);
    const withinGrace =
      rotatedAt && now.getTime() - rotatedAt.getTime() <= REFRESH_ROTATION_GRACE_MS;
    if (!withinGrace) return { kind: 'invalid', reason: 'rotated' };

    const replacement = list.find((item) => item.token === entry.replacedBy);
    const replacementExpiry = replacement ? asDate(replacement.expiresAt) : null;
    if (!replacement || !replacementExpiry || replacementExpiry <= now) {
      return { kind: 'invalid', reason: 'rotated' };
    }
    return { kind: 'replay', entry, replacement };
  }

  const expiresAt = asDate(entry.expiresAt);
  if (!expiresAt || expiresAt <= now) return { kind: 'invalid', reason: 'expired' };

  return { kind: 'rotate', entry };
};

/**
 * Atomically marks `oldToken` as rotated and appends `replacement`, in one
 * update that only matches if nobody else rotated it first. Also prunes
 * expired tokens and rotated tokens whose grace window has passed.
 *
 * Returns false when the token was already rotated by a concurrent request;
 * the caller should re-read and resolve again (it will get a replay).
 */
export const rotateRefreshToken = async (
  userId: Types.ObjectId | string,
  oldToken: string,
  deviceId: string,
  replacement: RefreshTokenEntry,
  now = new Date()
): Promise<boolean> => {
  const graceCutoff = new Date(now.getTime() - REFRESH_ROTATION_GRACE_MS);

  const result = await User.updateOne(
    {
      _id: userId,
      refreshTokens: {
        $elemMatch: { token: oldToken, deviceId, replacedBy: { $exists: false } },
      },
    },
    [
      {
        $set: {
          refreshTokens: {
            $concatArrays: [
              {
                $map: {
                  input: { $ifNull: ['$refreshTokens', []] },
                  as: 't',
                  in: {
                    $cond: [
                      { $eq: ['$$t.token', oldToken] },
                      { $mergeObjects: ['$$t', { replacedBy: replacement.token, rotatedAt: now }] },
                      '$$t',
                    ],
                  },
                },
              },
              [replacement],
            ],
          },
        },
      },
      {
        $set: {
          refreshTokens: {
            $filter: {
              input: '$refreshTokens',
              as: 't',
              cond: {
                $and: [
                  { $gt: ['$$t.expiresAt', now] },
                  {
                    $or: [
                      { $eq: [{ $type: '$$t.replacedBy' }, 'missing'] },
                      { $gt: ['$$t.rotatedAt', graceCutoff] },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    ]
  );

  return result.modifiedCount === 1;
};
