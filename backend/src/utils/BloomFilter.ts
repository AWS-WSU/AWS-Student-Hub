const DEFAULT_FALSE_POSITIVE_RATE = 0.01;
const MAX_HASH_COUNT = 16;

const hashString = (value: string, seed: number): number => {
  let hash = seed >>> 0;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x5bd1e995);
    hash ^= hash >>> 15;
  }

  return hash >>> 0;
};

export class BloomFilter {
  readonly bitCount: number;
  readonly hashCount: number;

  private readonly bits: Uint8Array;

  constructor(expectedItems: number, falsePositiveRate = DEFAULT_FALSE_POSITIVE_RATE) {
    if (!Number.isInteger(expectedItems) || expectedItems < 1) {
      throw new RangeError('expectedItems must be a positive integer');
    }

    if (falsePositiveRate <= 0 || falsePositiveRate >= 1) {
      throw new RangeError('falsePositiveRate must be between 0 and 1');
    }

    const naturalLogOfTwo = Math.log(2);
    this.bitCount = Math.max(
      8,
      Math.ceil(
        (-expectedItems * Math.log(falsePositiveRate)) / (naturalLogOfTwo * naturalLogOfTwo)
      )
    );
    this.hashCount = Math.min(
      MAX_HASH_COUNT,
      Math.max(1, Math.round((this.bitCount / expectedItems) * naturalLogOfTwo))
    );
    this.bits = new Uint8Array(Math.ceil(this.bitCount / 8));
  }

  add(value: string): void {
    for (const bitIndex of this.getBitIndexes(value)) {
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;
      this.bits[byteIndex] |= 1 << bitOffset;
    }
  }

  mightContain(value: string): boolean {
    for (const bitIndex of this.getBitIndexes(value)) {
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;

      if ((this.bits[byteIndex] & (1 << bitOffset)) === 0) {
        return false;
      }
    }

    return true;
  }

  private getBitIndexes(value: string): number[] {
    const firstHash = hashString(value, 0x811c9dc5);
    const secondHash = (hashString(value, 0x9747b28c) | 1) >>> 0;
    const indexes: number[] = [];

    for (let index = 0; index < this.hashCount; index += 1) {
      const combinedHash = (firstHash + Math.imul(index, secondHash)) >>> 0;
      indexes.push(combinedHash % this.bitCount);
    }

    return indexes;
  }
}
