import { describe, expect, it } from 'bun:test';

import {
  BUILDER_WARS_KEY,
  builderWarsBroadcast,
} from '../src/services/broadcasts/builderWarsEmail';
import {
  BroadcastNotFoundError,
  getBroadcastDefinition,
  listBroadcastKeys,
} from '../src/services/broadcastService';

const recipient = { email: 'ada@wayne.edu', fullName: 'Ada Lovelace' };

describe('builder wars broadcast email', () => {
  it('is registered under its key', () => {
    expect(listBroadcastKeys()).toContain(BUILDER_WARS_KEY);
    expect(getBroadcastDefinition(BUILDER_WARS_KEY)).toBe(builderWarsBroadcast);
    expect(() => getBroadcastDefinition('nope')).toThrow(BroadcastNotFoundError);
  });

  it('greets by first name and links to registration', () => {
    const html = builderWarsBroadcast.buildHtml(recipient);
    expect(html).toContain('Hey Ada,');
    expect(html).toContain('https://builderwars.dev');
    expect(html).toContain('wayneaws.dev/builder-wars');
    expect(html).toContain('Newlab Detroit');

    const text = builderWarsBroadcast.buildText(recipient);
    expect(text).toContain('Hey Ada,');
    expect(text).toContain('https://builderwars.dev');
  });

  it('escapes names so recipients cannot inject markup', () => {
    const html = builderWarsBroadcast.buildHtml({
      email: 'x@y.z',
      fullName: '<img src=x onerror=alert(1)> Smith',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('falls back to a generic greeting for blank names', () => {
    expect(builderWarsBroadcast.buildText({ email: 'x@y.z', fullName: '   ' })).toContain(
      'Hey builder,'
    );
  });

  it('phrases urgency relative to kickoff', () => {
    const kickoff = Date.UTC(2026, 10, 14, 15, 0, 0);
    const day = 24 * 60 * 60 * 1000;
    expect(builderWarsBroadcast.buildText(recipient, kickoff - 11 * day)).toContain(
      'Kickoff is 11 days out.'
    );
    expect(builderWarsBroadcast.buildText(recipient, kickoff - day)).toContain(
      'Kickoff is tomorrow.'
    );
    expect(builderWarsBroadcast.buildText(recipient, kickoff - 60_000)).toContain(
      'Kickoff is today.'
    );
    expect(builderWarsBroadcast.buildText(recipient, kickoff + day)).toContain('Doors are open.');
  });
});
