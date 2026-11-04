import { describe, expect, it } from 'bun:test';

import {
  NETWORK_DEFER_MS,
  THROTTLE_DEFER_MS,
  classifyTransientSmtpError,
  transientDeferMs,
} from '../src/services/smtpErrors';

describe('classifyTransientSmtpError', () => {
  it('treats 4xx SMTP replies as throttling', () => {
    expect(
      classifyTransientSmtpError({ responseCode: 421, message: 'Service not available' })
    ).toBe('throttled');
    expect(classifyTransientSmtpError({ responseCode: 451, message: 'Try again later' })).toBe(
      'throttled'
    );
  });

  it("recognises Gmail's daily limit even though it is a 550", () => {
    expect(
      classifyTransientSmtpError({
        responseCode: 550,
        message: '550-5.4.5 Daily user sending limit exceeded.',
      })
    ).toBe('throttled');
  });

  it('treats socket failures as network blips', () => {
    expect(classifyTransientSmtpError({ code: 'ETIMEDOUT', message: 'Connection timeout' })).toBe(
      'network'
    );
    expect(classifyTransientSmtpError({ code: 'ECONNRESET', message: 'read ECONNRESET' })).toBe(
      'network'
    );
  });

  it('leaves permanent rejections alone so they burn an attempt', () => {
    expect(
      classifyTransientSmtpError({
        responseCode: 535,
        message: '535-5.7.8 Username and Password not accepted',
      })
    ).toBeNull();
    expect(
      classifyTransientSmtpError({
        responseCode: 550,
        message: '550 5.1.1 The email account does not exist',
      })
    ).toBeNull();
    expect(classifyTransientSmtpError(new Error('boom'))).toBeNull();
    expect(classifyTransientSmtpError(null)).toBeNull();
    expect(classifyTransientSmtpError('string')).toBeNull();
  });

  it('defers throttling longer than network errors', () => {
    expect(transientDeferMs('throttled')).toBe(THROTTLE_DEFER_MS);
    expect(transientDeferMs('network')).toBe(NETWORK_DEFER_MS);
    expect(THROTTLE_DEFER_MS).toBeGreaterThan(NETWORK_DEFER_MS);
  });
});
