import crypto from 'crypto';
import { newDb } from 'pg-mem';

import env from '../config/env';
import type { IChallengeDocument } from '../models/Challenge';
import type { IChallengeProgressDocument } from '../models/ChallengeProgress';
import type { IUserDocument } from '../models/User';

export const SQL_INJECTION_VALIDATOR_TYPE = 'sql_injection' as const;

const DEFAULT_TABLE_NAME = 'archive_records';
const DEFAULT_MAX_INPUT_LENGTH = 180;
const DEFAULT_MAX_ROWS = 20;
const MAX_CONFIGURED_ROWS = 50;

export interface SqlInjectionSandboxConfig {
  type: typeof SQL_INJECTION_VALIDATOR_TYPE;
  tableName: string;
  maxInputLength: number;
  maxRows: number;
  successMessage?: string;
}

export interface SqlInjectionSandboxContext {
  challenge: IChallengeDocument;
  progress: IChallengeProgressDocument;
  user: IUserDocument;
}

export interface SqlInjectionSandboxRow {
  id: number;
  title: string;
  department: string;
  classification: string;
  content: string;
}

export interface SqlInjectionSandboxSearchResult {
  statement: string;
  rows: SqlInjectionSandboxRow[];
  rowCount: number;
  truncated: boolean;
  queryError?: string;
}

const cleanString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const normalizeBoundedInteger = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= minimum && numericValue <= maximum
    ? numericValue
    : fallback;
};

export const normalizeSqlInjectionSandboxConfig = (
  rawConfig: Record<string, unknown>
): SqlInjectionSandboxConfig => {
  if (rawConfig.type !== SQL_INJECTION_VALIDATOR_TYPE) {
    throw new Error('Invalid SQL injection sandbox validator config type.');
  }

  const tableName = cleanString(rawConfig.tableName) || DEFAULT_TABLE_NAME;
  if (!/^[a-z][a-z0-9_]{2,47}$/.test(tableName)) {
    throw new Error(
      'SQL injection sandbox tableName must be a lowercase SQL identifier between 3 and 48 characters.'
    );
  }

  return {
    type: SQL_INJECTION_VALIDATOR_TYPE,
    tableName,
    maxInputLength: normalizeBoundedInteger(
      rawConfig.maxInputLength,
      DEFAULT_MAX_INPUT_LENGTH,
      40,
      500
    ),
    maxRows: normalizeBoundedInteger(rawConfig.maxRows, DEFAULT_MAX_ROWS, 1, MAX_CONFIGURED_ROWS),
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

export const buildSqlInjectionCompletionToken = (context: SqlInjectionSandboxContext): string => {
  const digest = crypto
    .createHmac('sha256', getSigningSecret())
    .update(
      [
        'sql-injection-sandbox',
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

const compareTokens = (submitted: string, expected: string): boolean => {
  const submittedBuffer = Buffer.from(submitted);
  const expectedBuffer = Buffer.from(expected);
  return (
    submittedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(submittedBuffer, expectedBuffer)
  );
};

export const validateSqlInjectionCompletionToken = (
  submittedToken: string,
  context: SqlInjectionSandboxContext
): boolean => {
  return compareTokens(submittedToken.trim(), buildSqlInjectionCompletionToken(context));
};

const escapeSqlLiteral = (value: string): string => value.replace(/'/g, "''");

const createSandboxDatabase = (tableName: string, completionToken: string) => {
  const database = newDb({ autoCreateForeignKeyIndices: false });
  database.public.none(`
    CREATE TABLE ${tableName} (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      department TEXT NOT NULL,
      classification TEXT NOT NULL,
      content TEXT NOT NULL,
      published BOOLEAN NOT NULL DEFAULT TRUE
    );

    INSERT INTO ${tableName} (id, title, department, classification, content, published) VALUES
      (101, 'Cloud orientation schedule', 'Student Programs', 'PUBLIC', 'Tuesday sessions begin at 5:30 PM.', TRUE),
      (204, 'Lambda workshop notes', 'Engineering', 'PUBLIC', 'Bring a laptop with the AWS CLI installed.', TRUE),
      (318, 'Certification study group', 'Education', 'PUBLIC', 'Practice exams open after the kickoff meeting.', TRUE),
      (427, 'Infrastructure office hours', 'Operations', 'PUBLIC', 'Questions are accepted in the weekly lab.', TRUE),
      (9001, 'Internal access ledger', 'Security', 'RESTRICTED', '${escapeSqlLiteral(
        completionToken
      )}', FALSE);
  `);
  return database;
};

const validateSearchInput = (input: unknown, config: SqlInjectionSandboxConfig): string => {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('Enter a search term or SQL payload.');
  }
  if (input.length > config.maxInputLength) {
    throw new Error(`Search input must be ${config.maxInputLength} characters or fewer.`);
  }
  const hasControlCharacter = Array.from(input).some((character) => {
    const codePoint = character.codePointAt(0) || 0;
    return codePoint <= 31 || codePoint === 127;
  });
  if (hasControlCharacter) {
    throw new Error('Search input cannot contain control characters.');
  }
  if (input.includes(';')) {
    throw new Error('Stacked SQL statements are disabled in this sandbox.');
  }
  return input;
};

const isSandboxRow = (value: unknown): value is SqlInjectionSandboxRow => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'number' &&
    typeof row.title === 'string' &&
    typeof row.department === 'string' &&
    typeof row.classification === 'string' &&
    typeof row.content === 'string'
  );
};

export const runSqlInjectionSandboxQuery = (
  rawConfig: Record<string, unknown>,
  rawInput: unknown,
  context: SqlInjectionSandboxContext
): SqlInjectionSandboxSearchResult => {
  const config = normalizeSqlInjectionSandboxConfig(rawConfig);
  const input = validateSearchInput(rawInput, config);
  const completionToken = buildSqlInjectionCompletionToken(context);
  const database = createSandboxDatabase(config.tableName, completionToken);
  const statement = `SELECT id, title, department, classification, content FROM ${config.tableName} WHERE title ILIKE '%${input}%' AND published = TRUE ORDER BY id`;

  try {
    const result = database.public.query(statement);
    const allRows = result.rows.filter(isSandboxRow);
    const rows = allRows.slice(0, config.maxRows);
    return {
      statement,
      rows,
      rowCount: rows.length,
      truncated: allRows.length > rows.length,
    };
  } catch {
    return {
      statement,
      rows: [],
      rowCount: 0,
      truncated: false,
      queryError: 'The database rejected that statement. Check its quoting and comment syntax.',
    };
  }
};

export const getSqlInjectionPublicExperience = (rawConfig: Record<string, unknown>) => {
  const config = normalizeSqlInjectionSandboxConfig(rawConfig);
  return {
    type: SQL_INJECTION_VALIDATOR_TYPE,
    tableName: config.tableName,
    maxInputLength: config.maxInputLength,
  };
};

export const getSqlInjectionSuccessMessage = (rawConfig: Record<string, unknown>): string => {
  return (
    normalizeSqlInjectionSandboxConfig(rawConfig).successMessage ||
    'Restricted record recovered. SQL injection challenge complete.'
  );
};
