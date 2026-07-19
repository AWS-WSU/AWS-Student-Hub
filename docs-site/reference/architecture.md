# Architecture

The challenge platform is a catalog-and-assignment system with Prizeversity-backed identity and rewards.

## System boundaries

| System          | Owns                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| AWS Student Hub | Challenge definitions, classroom assignments, attempts, submissions, reviews, completion state, and reward-delivery records. |
| Prizeversity    | Classroom membership, external user IDs, balances, bits, XP, levels, multipliers, and API-key scope enforcement.             |
| SMTP provider   | Delivery of account-link ownership codes to Prizeversity member emails.                                                      |

AWS Student Hub does not maintain a second wallet. It sends a completion reward to Prizeversity and records the delivery result.

## Domain graph

<div class="doc-model">
  <div><strong>RewardIntegrationInstance</strong><span>Maps server-side credentials to one Prizeversity classroom.</span></div>
  <div><strong>ChallengeAssignment</strong><span>Maps one published definition to one instance.</span></div>
  <div><strong>ChallengeProgress</strong><span>Maps one user to one assignment.</span></div>
  <div><strong>RewardIntegrationEmission</strong><span>Records one external reward attempt and response.</span></div>
</div>

`ChallengeAssignment` also references `Challenge`. `User` references the selected reward instance and external Prizeversity identity. `ChallengeSubmission` references the user, definition, assignment, and progress record.

## Application layers

### Routes and middleware

Express routes expose student challenge operations, account linking, and admin operations. Student routes use JWT authentication where identity is required. Admin routes use the role hierarchy in `adminAuth.ts`.

### Services

- `challengeService.ts` orchestrates visibility, progress, submissions, review, and completion.
- `challengeAssignmentService.ts` owns per-instance assignment mutation and summaries.
- `challengeValidatorService.ts` normalizes validator configuration and executes validators.
- `challengeRewardService.ts` translates accepted completion into a reward command.
- `rewardIntegrationService.ts` owns Prizeversity requests, instance credentials, roster matching, account linking, and emission idempotency.

### Persistence

Mongoose models enforce stable keys, assignment uniqueness, progress uniqueness, completion-event uniqueness, and reward-emission uniqueness.

### Frontend

The React application renders the global catalog, instance workspace, student challenge hub, account-link workflow, specialized curated experiences, and manual-review controls. The frontend never decides whether a challenge is complete.

## Student visibility flow

`GET /challenges` follows this path:

1. Resolve the authenticated AWS user when available.
2. Require a stored reward instance link.
3. Confirm the instance exists and is active.
4. Load published assignments in the current availability window for that instance.
5. Load only published definitions referenced by those assignments.
6. Load progress by user and assignment.
7. Return assignment values for reward, dates, and attempts alongside reusable definition content.

The response does not expose assignments belonging to another instance.

## Submission flow

`POST /challenges/:slug/submit` performs:

1. Linked-user and active-instance enforcement.
2. Published definition and active assignment resolution.
3. Reward identity enforcement for rewardable assignments.
4. Progress creation or retrieval by user and assignment.
5. Completion and attempt-limit checks.
6. Validator execution with typed context.
7. Sanitized submission persistence.
8. Pending-review transition or immediate completion.
9. Prizeversity reward delivery when enabled.
10. Final progress status persistence.

Repeated submission after completion returns the existing completion state rather than rerunning validation.

## Manual review flow

A manual validator returns `pending_review`. Progress and submission records remain linked to the assignment and instance. Approval loads that assignment, marks the submission accepted, completes progress, and uses the assignment's reward configuration. Rejection returns progress to `in_progress` without reducing the attempt count.

## Curated route flow

Specialized routes, such as Ciphered Seal, resolve their challenge by validator-specific metadata and then apply the same linked-instance and active-assignment checks. Obscure route knowledge alone does not grant access.

## Environment fallback

If no active database-backed instances exist, the reward service can expose one `env` instance from deployment variables. This supports older single-classroom environments but does not provide a manageable multi-class catalog workspace.

## Important implementation constraints

- An AWS user links to one instance at a time.
- One definition may be assigned at most once to a given instance.
- One progress record exists per user and assignment.
- One completion event exists per user and assignment.
- One sent reward exists per AWS user, Prizeversity classroom, and challenge key.
- All admins currently share global management access.
- Definitions are live references, not immutable content snapshots.
