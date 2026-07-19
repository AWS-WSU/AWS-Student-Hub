# Curated challenges

Curated challenges are source-controlled experiences that still participate in the same catalog, assignment, progress, and reward lifecycle as custom challenges.

They are appropriate when generic secret or manual-review validation cannot represent the experience safely or clearly.

## What belongs in source control

A curated challenge may include:

- A dedicated frontend component and stylesheet
- Public challenge assets
- A hidden or specialized application route
- Per-user state derivation
- A backend service implementing challenge rules
- A registered validator
- Specialized authenticated endpoints
- A seed script that registers the reusable catalog definition

Keep challenge-specific files together under a clearly named challenge directory when possible. Shared catalog, assignment, progress, and reward behavior belongs in the generic challenge services rather than inside the feature directory.

## Registration is not assignment

The seed script creates or updates the catalog definition in a target database. It does not determine which teachers or classrooms can run the challenge.

After registration:

1. An admin verifies that the definition is published in the catalog.
2. The admin opens a Prizeversity instance.
3. The admin adds the definition from the catalog.
4. The assignment supplies dates, attempts, and rewards for that classroom.

Run seed scripts separately for each environment whose catalog should contain that curated definition.

## Current curated patterns

| Experience             | Validator pattern | Supporting behavior                                                                    |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| AWS Cloud Security Lab | `aws_secret`      | Uses the authenticated user's assigned AWS challenge secret.                           |
| Robots.txt Trap        | `static_secret`   | Adds `/robots.txt` discovery and a dedicated hidden vault route.                       |
| Ciphered Seal Protocol | `ciphered_seal`   | Adds a metadata route key, per-user layout, calculator state, and sequence validation. |

The Robots.txt challenge demonstrates that a curated experience may reuse a generic validator while still requiring source-controlled routes and presentation.

## Implementing a curated validator

The backend validator contract lives in `challengeValidatorService.ts`:

```ts
interface ChallengeValidator {
  type: string;
  validate(
    config: Record<string, unknown>,
    payload: unknown,
    context: ChallengeValidatorContext
  ): Promise<ChallengeValidationResult>;
  sanitizePayload?(payload: unknown): Record<string, unknown>;
}
```

A validator must:

- Normalize and validate its stored configuration.
- Treat submission payloads as `unknown` until narrowed.
- Return `accepted`, `rejected`, or `pending_review` behavior deliberately.
- Sanitize submission previews so secrets and tokens are never retained in plaintext.
- Avoid trusting client-computed success state.
- Produce stable, student-safe messages.

Register the validator with `registerChallengeValidator`. Generic admin-created challenges remain intentionally restricted to `static_secret` and `manual_review`; curated definitions are registered through source-controlled seed scripts.

## Frontend experience boundary

The frontend may guide interaction, but the backend remains authoritative for acceptance. Any value shipped to the browser can be inspected by a student.

Do not embed a correct sequence, plaintext flag, private AWS credential, or validation key in a client bundle merely because the route is obscure.

Specialized public data should be returned through an authenticated challenge endpoint after the backend confirms:

- The user has a linked active instance.
- The definition is published.
- The assignment is published and in its availability window.
- The requested route belongs to that assigned challenge.

## Seed script requirements

A curated seed should be idempotent and should:

- Upsert by stable challenge key.
- Set `source` to `curated`.
- Set a globally unique slug.
- Store only normalized validator configuration.
- Use an active admin or superuser as `createdBy`/`updatedBy`.
- Set default reward values without creating classroom assignments.
- Preserve the intended version on existing records unless a deliberate migration is required.

Add a named backend package script so operators do not need to invoke a TypeScript file path manually.

## Release checklist

1. Exercise the validator with correct, incorrect, malformed, and repeated payloads.
2. Verify payload previews redact sensitive values.
3. Verify an unlinked student cannot access the experience.
4. Verify a linked student in an unassigned classroom receives no challenge data.
5. Verify opening and closing windows apply to specialized routes.
6. Verify completion creates only one reward emission.
7. Seed a non-production database and assign through the normal admin workflow.
8. Deploy code before seeding the production definition.
9. Seed production, then assign it to selected instances.

## Removal

Curated definitions cannot be deleted from the dashboard. Archive the catalog definition to suppress it globally, or archive only a classroom assignment to remove it from one instance.
