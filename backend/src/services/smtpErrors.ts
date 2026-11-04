/**
 * Classifies SMTP failures so queues can tell "try later, don't charge an
 * attempt" apart from "this recipient really failed".
 */

const THROTTLE_CODES = new Set([421, 450, 451, 452, 454]);
const THROTTLE_PATTERN = /daily.*limit|sending limit|rate limit|too many|try again later|temporar/i;
const NETWORK_CODES = new Set([
  'ETIMEDOUT',
  'ECONNECTION',
  'ECONNRESET',
  'ECONNREFUSED',
  'ESOCKET',
  'EDNS',
  'EAI_AGAIN',
]);

export const THROTTLE_DEFER_MS = 30 * 60 * 1000;
export const NETWORK_DEFER_MS = 5 * 60 * 1000;

export type TransientKind = 'throttled' | 'network';

interface SmtpLikeError {
  responseCode?: unknown;
  code?: unknown;
  message?: unknown;
}

/**
 * Returns the kind of transient failure, or null when the error is a
 * permanent rejection (bad address, auth failure, malformed message...).
 */
export const classifyTransientSmtpError = (error: unknown): TransientKind | null => {
  if (!error || typeof error !== 'object') return null;
  const e = error as SmtpLikeError;

  const responseCode = typeof e.responseCode === 'number' ? e.responseCode : undefined;
  const code = typeof e.code === 'string' ? e.code : undefined;
  const message = typeof e.message === 'string' ? e.message : '';

  if (responseCode !== undefined && THROTTLE_CODES.has(responseCode)) return 'throttled';
  if (THROTTLE_PATTERN.test(message)) return 'throttled';
  if (code && NETWORK_CODES.has(code)) return 'network';

  return null;
};

export const transientDeferMs = (kind: TransientKind): number =>
  kind === 'throttled' ? THROTTLE_DEFER_MS : NETWORK_DEFER_MS;
