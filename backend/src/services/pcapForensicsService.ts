import crypto from 'crypto';

import env from '../config/env';
import type { IChallengeDocument } from '../models/Challenge';
import type { IChallengeProgressDocument } from '../models/ChallengeProgress';
import type { IUserDocument } from '../models/User';

export const PCAP_FORENSICS_VALIDATOR_TYPE = 'pcap_forensics' as const;

const DEFAULT_FILE_NAME = 'network-evidence.pcap';
const PCAP_PACKET_COUNT = 7;

export interface PcapForensicsConfig {
  type: typeof PCAP_FORENSICS_VALIDATOR_TYPE;
  fileName: string;
  successMessage?: string;
}

export interface PcapForensicsContext {
  challenge: IChallengeDocument;
  progress: IChallengeProgressDocument;
  user: IUserDocument;
}

const cleanString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

export const normalizePcapForensicsConfig = (
  rawConfig: Record<string, unknown>
): PcapForensicsConfig => {
  if (rawConfig.type !== PCAP_FORENSICS_VALIDATOR_TYPE) {
    throw new Error('Invalid PCAP forensics validator config type.');
  }

  const fileName = cleanString(rawConfig.fileName) || DEFAULT_FILE_NAME;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,78}\.pcap$/.test(fileName)) {
    throw new Error('PCAP fileName must be a safe filename ending in .pcap.');
  }

  return {
    type: PCAP_FORENSICS_VALIDATOR_TYPE,
    fileName,
    successMessage: cleanString(rawConfig.successMessage) || undefined,
  };
};

const getSigningSecret = (): string => {
  const secret = env.CHALLENGE_SIGNING_SECRET || env.JWT_SECRET;
  if (!secret) {
    throw new Error('Challenge signing secret is not configured.');
  }
  return secret;
};

export const buildPcapForensicsFlag = (context: PcapForensicsContext): string => {
  const digest = crypto
    .createHmac('sha256', getSigningSecret())
    .update(
      [
        'pcap-forensics',
        String(context.challenge._id),
        String(context.challenge.version),
        String(context.progress.assignmentId),
        String(context.user._id),
      ].join(':')
    )
    .digest('hex')
    .slice(0, 24);

  return `FLAG{${digest}}`;
};

const timingSafeEqual = (submitted: string, expected: string): boolean => {
  const submittedBuffer = Buffer.from(submitted);
  const expectedBuffer = Buffer.from(expected);
  return (
    submittedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(submittedBuffer, expectedBuffer)
  );
};

export const validatePcapForensicsFlag = (
  submittedFlag: string,
  context: PcapForensicsContext
): boolean => {
  return timingSafeEqual(submittedFlag.trim(), buildPcapForensicsFlag(context));
};

const internetChecksum = (value: Buffer): number => {
  let sum = 0;
  for (let offset = 0; offset < value.length; offset += 2) {
    const high = value[offset];
    const low = offset + 1 < value.length ? value[offset + 1] : 0;
    sum += (high << 8) | low;
    while (sum > 0xffff) {
      sum = (sum & 0xffff) + (sum >>> 16);
    }
  }
  return ~sum & 0xffff;
};

const parseIpv4Address = (address: string): Buffer => {
  const octets = address.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    throw new Error('Invalid IPv4 address in PCAP fixture.');
  }
  return Buffer.from(octets);
};

const parseMacAddress = (address: string): Buffer => {
  const octets = address.split(':').map((octet) => Number.parseInt(octet, 16));
  if (octets.length !== 6 || octets.some((octet) => !Number.isInteger(octet))) {
    throw new Error('Invalid MAC address in PCAP fixture.');
  }
  return Buffer.from(octets);
};

const buildIpv4Packet = (
  sourceIp: string,
  destinationIp: string,
  protocol: number,
  payload: Buffer,
  identification: number
): Buffer => {
  const header = Buffer.alloc(20);
  header[0] = 0x45;
  header[1] = 0;
  header.writeUInt16BE(header.length + payload.length, 2);
  header.writeUInt16BE(identification & 0xffff, 4);
  header.writeUInt16BE(0x4000, 6);
  header[8] = 64;
  header[9] = protocol;
  parseIpv4Address(sourceIp).copy(header, 12);
  parseIpv4Address(destinationIp).copy(header, 16);
  header.writeUInt16BE(internetChecksum(header), 10);
  return Buffer.concat([header, payload]);
};

const buildEthernetFrame = (
  sourceMac: string,
  destinationMac: string,
  ipv4Packet: Buffer
): Buffer => {
  const header = Buffer.alloc(14);
  parseMacAddress(destinationMac).copy(header, 0);
  parseMacAddress(sourceMac).copy(header, 6);
  header.writeUInt16BE(0x0800, 12);
  return Buffer.concat([header, ipv4Packet]);
};

const encodeDnsName = (name: string): Buffer => {
  const labels = name.split('.');
  const encodedLabels = labels.map((label) => {
    const bytes = Buffer.from(label, 'ascii');
    if (bytes.length === 0 || bytes.length > 63) {
      throw new Error('Invalid DNS label in PCAP fixture.');
    }
    return Buffer.concat([Buffer.from([bytes.length]), bytes]);
  });
  return Buffer.concat([...encodedLabels, Buffer.from([0])]);
};

const buildDnsQuery = (transactionId: number, name: string): Buffer => {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(transactionId, 0);
  header.writeUInt16BE(0x0100, 2);
  header.writeUInt16BE(1, 4);

  const questionFooter = Buffer.alloc(4);
  questionFooter.writeUInt16BE(1, 0);
  questionFooter.writeUInt16BE(1, 2);
  return Buffer.concat([header, encodeDnsName(name), questionFooter]);
};

const buildUdpDatagram = (sourcePort: number, destinationPort: number, payload: Buffer): Buffer => {
  const header = Buffer.alloc(8);
  header.writeUInt16BE(sourcePort, 0);
  header.writeUInt16BE(destinationPort, 2);
  header.writeUInt16BE(header.length + payload.length, 4);
  header.writeUInt16BE(0, 6);
  return Buffer.concat([header, payload]);
};

const buildTcpSegment = (
  sourceIp: string,
  destinationIp: string,
  sourcePort: number,
  destinationPort: number,
  sequenceNumber: number,
  acknowledgementNumber: number,
  flags: number,
  payload = Buffer.alloc(0)
): Buffer => {
  const header = Buffer.alloc(20);
  header.writeUInt16BE(sourcePort, 0);
  header.writeUInt16BE(destinationPort, 2);
  header.writeUInt32BE(sequenceNumber, 4);
  header.writeUInt32BE(acknowledgementNumber, 8);
  header[12] = 5 << 4;
  header[13] = flags;
  header.writeUInt16BE(64240, 14);

  const segment = Buffer.concat([header, payload]);
  const pseudoHeader = Buffer.alloc(12);
  parseIpv4Address(sourceIp).copy(pseudoHeader, 0);
  parseIpv4Address(destinationIp).copy(pseudoHeader, 4);
  pseudoHeader[8] = 0;
  pseudoHeader[9] = 6;
  pseudoHeader.writeUInt16BE(segment.length, 10);
  header.writeUInt16BE(internetChecksum(Buffer.concat([pseudoHeader, segment])), 16);
  return Buffer.concat([header, payload]);
};

const buildPcapHeader = (): Buffer => {
  const header = Buffer.alloc(24);
  header.writeUInt32LE(0xa1b2c3d4, 0);
  header.writeUInt16LE(2, 4);
  header.writeUInt16LE(4, 6);
  header.writeInt32LE(0, 8);
  header.writeUInt32LE(0, 12);
  header.writeUInt32LE(65535, 16);
  header.writeUInt32LE(1, 20);
  return header;
};

const buildPcapRecord = (packet: Buffer, index: number): Buffer => {
  const header = Buffer.alloc(16);
  header.writeUInt32LE(1_700_000_000 + index, 0);
  header.writeUInt32LE(index * 10_000, 4);
  header.writeUInt32LE(packet.length, 8);
  header.writeUInt32LE(packet.length, 12);
  return Buffer.concat([header, packet]);
};

export const buildPcapForensicsCapture = (context: PcapForensicsContext): Buffer => {
  const clientIp = '192.0.2.10';
  const resolverIp = '192.0.2.53';
  const serverIp = '198.51.100.42';
  const clientMac = '02:00:00:00:00:10';
  const resolverMac = '02:00:00:00:00:53';
  const serverMac = '02:00:00:00:00:42';
  const sourcePort = 51000;
  const clientSequence = 1000;
  const serverSequence = 5000;
  const flag = buildPcapForensicsFlag(context);

  const dnsNames = ['updates.packet-lab.local', 'inspect-http.packet-lab.local'];
  const dnsFrames = dnsNames.map((name, index) => {
    const query = buildDnsQuery(0x2400 + index, name);
    const udp = buildUdpDatagram(53000 + index, 53, query);
    return buildEthernetFrame(
      clientMac,
      resolverMac,
      buildIpv4Packet(clientIp, resolverIp, 17, udp, 0x1000 + index)
    );
  });

  const syn = buildTcpSegment(clientIp, serverIp, sourcePort, 80, clientSequence, 0, 0x02);
  const synAck = buildTcpSegment(
    serverIp,
    clientIp,
    80,
    sourcePort,
    serverSequence,
    clientSequence + 1,
    0x12
  );
  const ack = buildTcpSegment(
    clientIp,
    serverIp,
    sourcePort,
    80,
    clientSequence + 1,
    serverSequence + 1,
    0x10
  );
  const httpRequest = Buffer.from(
    [
      'GET /collect?source=student-workstation HTTP/1.1',
      'Host: telemetry.packet-lab.local',
      'User-Agent: AWS-Student-Builder-Forensics/1.0',
      `X-Forensics-Flag: ${flag}`,
      'Accept: */*',
      'Connection: close',
      '',
      '',
    ].join('\r\n'),
    'ascii'
  );
  const httpSegment = buildTcpSegment(
    clientIp,
    serverIp,
    sourcePort,
    80,
    clientSequence + 1,
    serverSequence + 1,
    0x18,
    httpRequest
  );
  const httpResponse = Buffer.from(
    ['HTTP/1.1 204 No Content', 'Server: packet-lab', 'Connection: close', '', ''].join('\r\n'),
    'ascii'
  );
  const responseSegment = buildTcpSegment(
    serverIp,
    clientIp,
    80,
    sourcePort,
    serverSequence + 1,
    clientSequence + 1 + httpRequest.length,
    0x18,
    httpResponse
  );

  const tcpFrames = [
    buildEthernetFrame(clientMac, serverMac, buildIpv4Packet(clientIp, serverIp, 6, syn, 0x2000)),
    buildEthernetFrame(
      serverMac,
      clientMac,
      buildIpv4Packet(serverIp, clientIp, 6, synAck, 0x2001)
    ),
    buildEthernetFrame(clientMac, serverMac, buildIpv4Packet(clientIp, serverIp, 6, ack, 0x2002)),
    buildEthernetFrame(
      clientMac,
      serverMac,
      buildIpv4Packet(clientIp, serverIp, 6, httpSegment, 0x2003)
    ),
    buildEthernetFrame(
      serverMac,
      clientMac,
      buildIpv4Packet(serverIp, clientIp, 6, responseSegment, 0x2004)
    ),
  ];

  const frames = [...dnsFrames, ...tcpFrames];
  if (frames.length !== PCAP_PACKET_COUNT) {
    throw new Error('PCAP fixture packet count is inconsistent.');
  }

  return Buffer.concat([
    buildPcapHeader(),
    ...frames.map((frame, index) => buildPcapRecord(frame, index)),
  ]);
};

export const getPcapForensicsPublicExperience = (rawConfig: Record<string, unknown>) => {
  const config = normalizePcapForensicsConfig(rawConfig);
  return {
    type: PCAP_FORENSICS_VALIDATOR_TYPE,
    fileName: config.fileName,
    packetCount: PCAP_PACKET_COUNT,
    protocols: ['DNS', 'TCP', 'HTTP'] as const,
  };
};

export const getPcapForensicsSuccessMessage = (rawConfig: Record<string, unknown>): string => {
  return (
    normalizePcapForensicsConfig(rawConfig).successMessage ||
    'Packet evidence validated. PCAP forensics challenge complete.'
  );
};
