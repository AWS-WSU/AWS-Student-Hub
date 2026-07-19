# Deployment and migrations

Deploy challenge code, migrate existing data when required, register curated definitions, and then assign them to classrooms. These are separate operations.

## Required backend configuration

| Variable          | Purpose                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `MONGODB_URI`     | Challenge, assignment, user-link, and reward-emission persistence. |
| `JWT_SECRET`      | Authentication and admin route verification.                       |
| `SMTP_HOST`       | Ownership-code mail server.                                        |
| `SMTP_PORT`       | SMTP port, normally `587` for STARTTLS.                            |
| `SMTP_ENCRYPTION` | SMTP transport mode.                                               |
| `SMTP_USER`       | Mailbox used to send verification codes.                           |
| `SMTP_PASS`       | Complete provider credential or app password.                      |

Legacy single-instance fallback variables:

- `PRIZEVERSITY_API_URL`
- `PRIZEVERSITY_API_KEY`
- `PRIZEVERSITY_CLASSROOM_ID`

Prefer database-backed instances for multi-classroom production operation.

## Deployment order

1. Back up the target MongoDB database.
2. Build and validate the release containing the current models and migration script.
3. Run required idempotent migrations from that release before exposing the upgraded API to traffic.
4. Deploy the backend and matching frontend.
5. Run source-controlled seed scripts for curated definitions that should exist there.
6. Verify instances from the admin dashboard.
7. Assign catalog definitions to selected instances.
8. Test a complete linked-student flow.

## Catalog assignment migration

Existing installations created before the catalog/assignment split require:

```bash
cd backend
MONGODB_URI='<target-mongodb-uri>' bun run migrate-challenge-catalog
```

The migration is idempotent. It:

- Classifies built-in definitions as curated and other definitions as custom.
- Converts legacy classroom scoping into assignments.
- Creates assignments for legacy globally published challenges when appropriate.
- Backfills assignment and instance IDs onto progress and submissions.
- Preserves historical progress with archived assignments when needed.
- Replaces legacy user/challenge uniqueness with assignment-aware indexes.

Run it once for every existing environment. A new empty environment using current models does not require legacy records to be converted.

## Curated challenge registration

Seeding is environment-specific because catalog definitions live in MongoDB. Examples:

```bash
cd backend
bun run seed-aws-cyber-challenge
bun run seed-robots-trap-challenge
bun run seed-ciphered-seal-challenge
```

Each command uses the active `MONGODB_URI`. Confirm the target before running it.

Seeding creates or updates definitions only. Teachers still assign those definitions through the admin dashboard.

## Documentation site

The handbook is built with VitePress and published under `/docs` in the main
Vercel deployment. Its VitePress base path is `/docs/`, so internal links and
assets remain valid at `https://wayneaws.dev/docs/`.

For a local standalone build:

```bash
bun install --cwd docs-site
bun run build:docs
```

Static output is written to:

```text
docs-site/.vitepress/dist
```

The production build uses the repository-root Vercel configuration. It builds
the frontend, builds the handbook, and copies the handbook into
`frontend/dist/docs`. Set the Vercel project root directory to the repository
root so Vercel uses `vercel.json` and `build:vercel`; do not leave it set to
`frontend/`.

## Production verification

After deployment, verify:

1. Admin and superuser access to catalog and instances.
2. Instance connection against a non-sensitive roster account.
3. Link-code delivery through production SMTP.
4. A student's classroom-specific challenge list.
5. Correct submission and manual review behavior.
6. Exactly one Prizeversity reward.
7. Reward emission status and external balance agreement.
8. Archived assignments remain hidden but retain history.

## Rollback considerations

Do not roll application code back to a version that assumes one progress record per user/challenge after running the assignment migration. Database indexes and new records follow assignment-aware semantics.

Prefer forward fixes. If database restoration is unavoidable, restore the application and database from compatible points together.
