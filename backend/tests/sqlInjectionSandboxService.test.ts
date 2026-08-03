import { beforeAll, describe, expect, it } from 'bun:test';

import env from '../src/config/env';
import type { IChallengeDocument } from '../src/models/Challenge';
import type { IChallengeProgressDocument } from '../src/models/ChallengeProgress';
import type { IUserDocument } from '../src/models/User';
import {
  buildSqlInjectionCompletionToken,
  runSqlInjectionSandboxQuery,
  SqlInjectionSandboxContext,
  validateSqlInjectionCompletionToken,
} from '../src/services/sqlInjectionSandboxService';

const config = {
  type: 'sql_injection',
  tableName: 'archive_records',
  maxInputLength: 180,
  maxRows: 20,
};

const createContext = (userId: string): SqlInjectionSandboxContext => ({
  challenge: { _id: 'challenge-1', version: 3 } as unknown as IChallengeDocument,
  progress: { assignmentId: 'assignment-1' } as unknown as IChallengeProgressDocument,
  user: { _id: userId } as unknown as IUserDocument,
});

beforeAll(() => {
  (env as { CHALLENGE_SIGNING_SECRET?: string }).CHALLENGE_SIGNING_SECRET =
    'sql-sandbox-test-signing-secret';
});

describe('SQL injection sandbox', () => {
  it('keeps the restricted row out of ordinary searches', () => {
    const result = runSqlInjectionSandboxQuery(config, 'Cloud', createContext('user-1'));

    expect(result.queryError).toBeUndefined();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].classification).toBe('PUBLIC');
    expect(result.rows.some((row) => row.content.startsWith('FLAG{'))).toBe(false);
  });

  it('allows the intended boolean injection to recover the personalized flag', () => {
    const context = createContext('user-1');
    const result = runSqlInjectionSandboxQuery(config, "' OR 1=1 --", context);
    const restrictedRow = result.rows.find((row) => row.classification === 'RESTRICTED');

    expect(result.queryError).toBeUndefined();
    expect(restrictedRow?.content).toBe(buildSqlInjectionCompletionToken(context));
    expect(validateSqlInjectionCompletionToken(restrictedRow?.content || '', context)).toBe(true);
  });

  it('derives different flags for different students', () => {
    expect(buildSqlInjectionCompletionToken(createContext('user-1'))).not.toBe(
      buildSqlInjectionCompletionToken(createContext('user-2'))
    );
  });

  it('rejects stacked statements', () => {
    expect(() =>
      runSqlInjectionSandboxQuery(config, "'; DROP TABLE archive_records; --", createContext('u'))
    ).toThrow('Stacked SQL statements are disabled');
  });
});
