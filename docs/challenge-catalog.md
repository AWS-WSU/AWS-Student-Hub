# Challenge catalog and classroom assignments

Challenge definitions and classroom delivery are separate concerns.

## Catalog definitions

`Challenge` stores reusable content and validation. A definition is either `curated`, meaning its supporting implementation is maintained in source control, or `custom`, meaning an admin authored it in the dashboard. Publishing a definition makes it available in the admin catalog; it does not make it visible to students.

Custom definitions support `static_secret` and `manual_review`. Curated validators such as `aws_secret` and `ciphered_seal` are seeded by their source-controlled implementations.

## Classroom assignments

`ChallengeAssignment` connects one catalog definition to one Prizeversity reward instance. Each assignment owns its classroom-specific status, release window, attempt limit, reward values, and challenge version marker.

A linked student sees a challenge only when all of the following are true:

- The linked reward instance is active.
- The catalog definition is published.
- The classroom assignment is published.
- The current time is inside the assignment release window.

Progress, submissions, manual review, completion events, and reward grants retain the assignment and reward-instance IDs. This lets the same catalog challenge run independently in multiple classrooms.

Removing an unused assignment deletes it. If student progress exists, removal archives the assignment so audit history is retained. Curated definitions cannot be deleted from the dashboard.

## Existing data

Run the idempotent `migrate-challenge-catalog` backend script once for each existing environment after deploying the new models. It converts legacy scope fields into assignments, backfills assignment IDs onto progress and submissions, and replaces the old user/challenge uniqueness index with assignment-aware uniqueness.
