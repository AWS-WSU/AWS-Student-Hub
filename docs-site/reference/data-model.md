# Data model

This page describes the current persisted records and the invariants relied on by services.

## Challenge

Reusable global definition.

| Field                    | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `key`                    | Stable internal identity; globally unique.           |
| `slug`                   | Student-facing URL identity; globally unique.        |
| `source`                 | `curated` or `custom`.                               |
| `status`                 | `draft`, `published`, or `archived`.                 |
| `kind`                   | `single` or `multi_part`.                            |
| `validation`             | Validator type and normalized private configuration. |
| `reward`                 | Defaults copied into new assignments.                |
| `version`                | Current validation revision.                         |
| `createdBy`, `updatedBy` | Admin audit references.                              |

`rewardIntegrationInstanceId`, definition-level dates, and definition-level attempt limits remain for migration/default compatibility. Runtime student delivery uses assignment values.

## ChallengeAssignment

Connects one definition to one reward instance.

| Field                         | Purpose                                       |
| ----------------------------- | --------------------------------------------- |
| `challengeId`                 | Catalog definition.                           |
| `rewardIntegrationInstanceId` | Target classroom instance.                    |
| `challengeVersion`            | Definition version observed on create/update. |
| `status`                      | Classroom delivery lifecycle.                 |
| `startsAt`, `endsAt`          | Availability window.                          |
| `maxAttempts`                 | Classroom-specific attempt limit.             |
| `hint`                        | Optional classroom-specific student guidance. |
| `reward`                      | Concrete classroom reward configuration.      |
| `assignedBy`, `updatedBy`     | Admin audit references.                       |

Unique index: `(challengeId, rewardIntegrationInstanceId)`.

## RewardIntegrationInstance

Server-side Prizeversity classroom connection.

| Field               | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `provider`          | Currently always `prizeversity`.                      |
| `apiBaseUrl`        | Trusted Prizeversity base host.                       |
| `apiKey`            | Full secret credential; excluded from normal queries. |
| `apiKeyPreview`     | Safe shortened value returned to admins.              |
| `classroomId`       | External classroom identity.                          |
| `classroomName`     | Human-readable external label.                        |
| `scopes`            | Expected integration capabilities.                    |
| `active`            | Master operational switch.                            |
| `lastVerification*` | Connection-test state.                                |
| `lastUserCount`     | Last roster size observed.                            |
| `createdBy`         | Immutable instructor ownership boundary.              |

Admin instance queries require `createdBy` to match the authenticated instructor. Assignments,
progress, submissions, reviews, and reward operations derive their administrative scope through this
owned instance reference. Catalog definitions remain global and reusable.

## RewardIntegrationMembership

Classroom-specific link between one AWS Student Hub user and one Prizeversity instance.

| Field                         | Purpose                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `awsUserId`, `instanceKey`    | Membership identity; unique together.                      |
| `rewardIntegrationInstanceId` | Database-backed instance reference when available.         |
| `prizeversityUserId`          | Verified external identity found in this classroom roster. |
| `classroomId`                 | External classroom scope.                                  |
| `active`, `disabledByUser`    | Roster state and explicit student disconnect state.        |
| `linkedAt`, `lastVerifiedAt`  | Connection and roster-check timestamps.                    |
| `lastVerificationError`       | Reason an inactive membership cannot currently be used.    |

Unique indexes prevent duplicate user-instance links and prevent one Prizeversity classroom member from being connected to multiple AWS Student Hub users.

## User identity fields

The user record stores the verified global Prizeversity identity:

- `rewardIntegrationInstanceId`
- `prizeversityUserId`
- `prizeversityClassroomId`
- `prizeversityEmail`
- `prizeversityMatchedName`
- `prizeversityShortId`
- `prizeversityLinkedAt`
- `prizeversityLastSyncedAt`

`rewardIntegrationInstanceId` and `prizeversityClassroomId` are retained as compatibility pointers to an active membership. Runtime authorization uses `RewardIntegrationMembership`. Removing the complete identity clears these fields and all memberships; disconnecting one classroom only changes that membership. Historical progress retains its assignment and instance references.

## RewardIntegrationLinkVerification

Temporary ownership challenge for account linking.

| Field                         | Purpose                                      |
| ----------------------------- | -------------------------------------------- |
| `awsUserId`                   | One pending request per AWS user.            |
| `instanceKey`                 | Selected database or environment instance.   |
| `rewardIntegrationInstanceId` | Selected classroom instance.                 |
| Prizeversity identity fields  | The matched member awaiting ownership proof. |
| `codeHash`, `codeSalt`        | Non-plaintext verification material.         |
| `attempts`                    | Failed verification count.                   |
| `expiresAt`                   | Ten-minute expiration and MongoDB TTL index. |

The document is deleted after successful verification, expiry handling, too many attempts, unlinking, or email-send failure.

## ChallengeProgress

Current state for one user and assignment.

| Field                         | Purpose                                             |
| ----------------------------- | --------------------------------------------------- |
| `userId`, `assignmentId`      | Progress identity.                                  |
| `challengeId`, `challengeKey` | Definition references retained for queries/audit.   |
| `rewardIntegrationInstanceId` | Classroom scope.                                    |
| `challengeVersion`            | Definition version when progress began.             |
| `status`                      | Work, review, completion, and reward state.         |
| `attemptCount`                | Number of validation submissions.                   |
| `completionEventId`           | Stable completion id unique to user and assignment. |
| `rewardEmissionId`            | External delivery record when present.              |

Partial unique index: `(userId, assignmentId)` when `assignmentId` is an ObjectId.

## ChallengeSubmission

Append-only submission attempt record.

The record includes user, challenge, assignment, instance, progress, validator type, status, sanitized payload preview, validator result metadata, and message. It does not intentionally retain raw submitted secrets.

Submission status is one of `accepted`, `pending_review`, `rejected`, or `error`.

## RewardIntegrationEmission

Outbound Prizeversity reward ledger.

| Field                | Purpose                          |
| -------------------- | -------------------------------- |
| `awsUserId`          | Internal recipient.              |
| `prizeversityUserId` | External recipient.              |
| `classroomId`        | External classroom.              |
| `challengeKey`       | Stable reward activity identity. |
| `requestPayload`     | Payload sent to Prizeversity.    |
| `status`             | `pending`, `sent`, or `failed`.  |
| `responsePayload`    | Successful external response.    |
| `errorMessage`       | Failed request reason.           |

Unique index: `(awsUserId, classroomId, challengeKey)`.

## Referential behavior

MongoDB references are not configured with automatic cascading deletion. Services preserve history deliberately:

- Removing an assignment with progress archives it.
- Deleting a custom definition is blocked while assignments exist.
- Curated definitions cannot be deleted through the admin service.
- Unlinking a user does not delete historical progress or emissions.
