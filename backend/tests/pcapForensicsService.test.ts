import { beforeAll, describe, expect, it } from 'bun:test';

import env from '../src/config/env';
import type { IChallengeDocument } from '../src/models/Challenge';
import type { IChallengeProgressDocument } from '../src/models/ChallengeProgress';
import type { IUserDocument } from '../src/models/User';
import {
  buildPcapForensicsCapture,
  buildPcapForensicsFlag,
  PcapForensicsContext,
  validatePcapForensicsFlag,
} from '../src/services/pcapForensicsService';
import {
  sanitizeChallengeSubmissionPayload,
  validateChallengeSubmission,
} from '../src/services/challengeValidatorService';

const createContext = (userId: string): PcapForensicsContext => ({
  challenge: { _id: 'challenge-pcap', version: 2 } as unknown as IChallengeDocument,
  progress: { assignmentId: 'assignment-pcap' } as unknown as IChallengeProgressDocument,
  user: { _id: userId } as unknown as IUserDocument,
});

const readPackets = (capture: Buffer): Buffer[] => {
  const packets: Buffer[] = [];
  let offset = 24;
  while (offset < capture.length) {
    const includedLength = capture.readUInt32LE(offset + 8);
    const originalLength = capture.readUInt32LE(offset + 12);
    expect(includedLength).toBe(originalLength);
    packets.push(capture.subarray(offset + 16, offset + 16 + includedLength));
    offset += 16 + includedLength;
  }
  expect(offset).toBe(capture.length);
  return packets;
};

beforeAll(() => {
  (env as { CHALLENGE_SIGNING_SECRET?: string }).CHALLENGE_SIGNING_SECRET =
    'pcap-forensics-test-signing-secret';
});

describe('PCAP forensics capture', () => {
  it('builds a valid Ethernet PCAP with DNS and TCP packets', () => {
    const capture = buildPcapForensicsCapture(createContext('user-1'));
    const packets = readPackets(capture);

    expect(capture.readUInt32LE(0)).toBe(0xa1b2c3d4);
    expect(capture.readUInt16LE(4)).toBe(2);
    expect(capture.readUInt16LE(6)).toBe(4);
    expect(capture.readUInt32LE(20)).toBe(1);
    expect(packets).toHaveLength(7);
    expect(packets.map((packet) => packet.readUInt16BE(12))).toEqual(
      Array.from({ length: 7 }, () => 0x0800)
    );
    expect(packets.map((packet) => packet[23])).toEqual([17, 17, 6, 6, 6, 6, 6]);
  });

  it('places the personalized flag in an HTTP request', () => {
    const context = createContext('user-1');
    const captureText = buildPcapForensicsCapture(context).toString('latin1');
    const expectedFlag = buildPcapForensicsFlag(context);

    expect(captureText).toContain('inspect-http');
    expect(captureText).toContain('GET /collect?source=student-workstation HTTP/1.1');
    expect(captureText).toContain(`X-Forensics-Flag: ${expectedFlag}`);
    expect(validatePcapForensicsFlag(expectedFlag, context)).toBe(true);
  });

  it('generates different evidence flags for different students', () => {
    const firstFlag = buildPcapForensicsFlag(createContext('user-1'));
    const secondFlag = buildPcapForensicsFlag(createContext('user-2'));

    expect(firstFlag).not.toBe(secondFlag);
    expect(validatePcapForensicsFlag(firstFlag, createContext('user-2'))).toBe(false);
  });

  it('uses the registered validator and redacts submitted flags', async () => {
    const context = createContext('user-1');
    const config = { type: 'pcap_forensics', fileName: 'network-evidence.pcap' };
    const flag = buildPcapForensicsFlag(context);
    const result = await validateChallengeSubmission(config, { flag }, context);

    expect(result.accepted).toBe(true);
    expect(sanitizeChallengeSubmissionPayload(config, { flag })).toEqual({
      submitted: true,
      flag: '[redacted]',
    });
  });
});
