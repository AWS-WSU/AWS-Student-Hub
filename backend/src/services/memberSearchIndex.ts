import logger from '../config/logger';
import User from '../models/User';
import { BloomFilter } from '../utils/BloomFilter';

const log = logger.child({ module: 'memberSearchIndex' });

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 64;
const MAX_FILTER_INSERTIONS = 2_000_000;
const FALSE_POSITIVE_RATE = 0.01;
const ASCII_SEARCH_PATTERN = /^[a-z0-9_ .'-]+$/;

interface SearchableMember {
  username?: string;
  fullName?: string;
}

interface MemberCollectionVersion {
  _id: unknown;
  updatedAt?: Date;
}

interface SearchIndexSnapshot {
  collectionFingerprint: string;
  filter: BloomFilter | null;
}

const normalizeSearchValue = (value: string): string => {
  return value.normalize('NFKC').toLowerCase();
};

const countSearchableSubstrings = (value: string): number => {
  const maxLength = Math.min(MAX_QUERY_LENGTH, value.length);
  let count = 0;

  for (let length = MIN_QUERY_LENGTH; length <= maxLength; length += 1) {
    count += value.length - length + 1;
  }

  return count;
};

const addSearchableSubstrings = (filter: BloomFilter, value: string): void => {
  const maxLength = Math.min(MAX_QUERY_LENGTH, value.length);

  for (let length = MIN_QUERY_LENGTH; length <= maxLength; length += 1) {
    for (let start = 0; start <= value.length - length; start += 1) {
      filter.add(value.slice(start, start + length));
    }
  }
};

class MemberSearchIndex {
  private snapshot: SearchIndexSnapshot | null = null;
  private rebuildPromise: Promise<SearchIndexSnapshot | null> | null = null;

  async isDefinitelyMissing(query: string): Promise<boolean> {
    const normalizedQuery = normalizeSearchValue(query);

    if (
      normalizedQuery.length < MIN_QUERY_LENGTH ||
      normalizedQuery.length > MAX_QUERY_LENGTH ||
      !ASCII_SEARCH_PATTERN.test(normalizedQuery)
    ) {
      return false;
    }

    try {
      const collectionFingerprint = await this.getCollectionFingerprint();

      if (this.snapshot?.collectionFingerprint !== collectionFingerprint) {
        this.snapshot = await this.rebuild();
      }

      return this.snapshot?.filter ? !this.snapshot.filter.mightContain(normalizedQuery) : false;
    } catch (error: unknown) {
      log.warn('member search bloom index unavailable; using database search.', error);
      return false;
    }
  }

  private async rebuild(): Promise<SearchIndexSnapshot | null> {
    if (this.rebuildPromise) {
      return this.rebuildPromise;
    }

    this.rebuildPromise = this.buildStableSnapshot();

    try {
      return await this.rebuildPromise;
    } finally {
      this.rebuildPromise = null;
    }
  }

  private async buildStableSnapshot(): Promise<SearchIndexSnapshot | null> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const fingerprintBefore = await this.getCollectionFingerprint();
      const members = (await User.find({})
        .select('username fullName')
        .lean()) as SearchableMember[];
      const fingerprintAfter = await this.getCollectionFingerprint();

      if (fingerprintBefore !== fingerprintAfter) {
        continue;
      }

      const searchableValues = members.flatMap((member) =>
        [member.username, member.fullName]
          .filter((value): value is string => Boolean(value))
          .map(normalizeSearchValue)
      );
      const insertionCount = searchableValues.reduce(
        (total, value) => total + countSearchableSubstrings(value),
        0
      );

      if (insertionCount > MAX_FILTER_INSERTIONS) {
        log.warn(
          `member search bloom index disabled: ${insertionCount} substrings exceed the configured limit.`
        );
        return {
          collectionFingerprint: fingerprintAfter,
          filter: null,
        };
      }

      const filter = new BloomFilter(Math.max(1, insertionCount), FALSE_POSITIVE_RATE);
      searchableValues.forEach((value) => addSearchableSubstrings(filter, value));

      log.info(
        `member search bloom index rebuilt for ${members.length} members and ${insertionCount} substrings.`
      );

      return {
        collectionFingerprint: fingerprintAfter,
        filter,
      };
    }

    log.warn('member collection changed during bloom index rebuild; using database search.');
    return null;
  }

  private async getCollectionFingerprint(): Promise<string> {
    const [memberCount, latestMember] = await Promise.all([
      User.countDocuments({}),
      User.findOne({}).sort({ updatedAt: -1, _id: -1 }).select('_id updatedAt').lean(),
    ]);
    const version = latestMember as MemberCollectionVersion | null;
    const updatedAt = version?.updatedAt ? new Date(version.updatedAt).getTime() : 0;

    return `${memberCount}:${String(version?._id ?? '')}:${updatedAt}`;
  }
}

const globalWithMemberSearchIndex = globalThis as typeof globalThis & {
  memberSearchIndex?: MemberSearchIndex;
};

export const memberSearchIndex =
  globalWithMemberSearchIndex.memberSearchIndex ??
  (globalWithMemberSearchIndex.memberSearchIndex = new MemberSearchIndex());
