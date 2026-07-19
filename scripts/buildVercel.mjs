import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const frontend = resolve(root, 'frontend');
const docs = resolve(root, 'docs-site');
const docsOutput = resolve(docs, '.vitepress/dist');
const publishedDocs = resolve(frontend, 'dist/docs');

const run = (cwd, args) => {
  execFileSync('bun', args, { cwd, stdio: 'inherit' });
};

run(frontend, ['install', '--frozen-lockfile']);
run(docs, ['install', '--frozen-lockfile']);
run(docs, ['run', 'build']);
run(frontend, ['run', 'build']);

rmSync(publishedDocs, { recursive: true, force: true });
mkdirSync(resolve(frontend, 'dist'), { recursive: true });
cpSync(docsOutput, publishedDocs, { recursive: true });
