# HTTP API

Routes below are relative to the configured backend origin. A deployed API Gateway stage may add a prefix such as `/prod`; the Express application itself mounts these paths directly.

## Authentication

Authenticated requests use:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

Student account and challenge mutations require a valid JWT. Every route under `/admin` listed here requires `admin` or `superuser`.

Error responses generally contain `error`. Challenge-domain errors also include a stable `code` and optional `details`.

```json
{
  "error": "This challenge is already assigned to the classroom.",
  "code": "CHALLENGE_ASSIGNMENT_EXISTS"
}
```

## Student Prizeversity routes

### `GET /integrations/prizeversity/status`

Returns active instances, configuration state, and the current user's linked account.

### `POST /integrations/prizeversity/link`

Starts verified linking.

```json
{
  "identifier": "student@example.edu",
  "instanceId": "<reward-instance-id>"
}
```

`identifier` may be omitted. `instanceId` should be supplied when the user selects among multiple classrooms.

Successful response includes `verificationRequired`, a masked destination email, and `expiresAt`. It does not establish the permanent link yet.

### `POST /integrations/prizeversity/link/verify`

```json
{
  "code": "123456"
}
```

Verifies the pending ownership code and stores the linked external identity.

### `DELETE /integrations/prizeversity/link`

Clears the user's linked identity and pending verification request.

## Student challenge routes

### `GET /challenges`

Returns only active assignments for the user's linked instance. An unlinked user receives an empty challenge array plus reward-link state.

Optional query filters: `tag`, `difficulty`.

### `GET /challenges/:slug`

Returns one assigned challenge, assignment-specific settings, progress, and reward-link state. Challenges outside the user's classroom resolve as not found.

### `GET /challenges/:slug/progress`

Returns current progress without creating it.

### `POST /challenges/:slug/start`

Creates progress in `in_progress` state if it does not exist.

### `POST /challenges/:slug/submit`

```json
{
  "payload": {
    "answer": "submitted proof"
  }
}
```

The payload shape is validator-specific. Response includes acceptance, completion, message, progress, and reward status.

### Ciphered Seal routes

```text
GET  /challenges/ciphered-seal/route/:routeKey
POST /challenges/ciphered-seal/route/:routeKey/resolve
```

The resolve body contains `seedNumber`. Both endpoints enforce linked instance and active assignment scope.

## Admin catalog routes

| Method   | Path                                             | Purpose                                                                               |
| -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `GET`    | `/admin/challenges`                              | Paginated catalog list; supports `status`, `search`, `page`, and `limit`.             |
| `POST`   | `/admin/challenges`                              | Create a custom draft definition.                                                     |
| `GET`    | `/admin/challenges/:challengeId`                 | Read full admin definition.                                                           |
| `PATCH`  | `/admin/challenges/:challengeId`                 | Update definition fields.                                                             |
| `POST`   | `/admin/challenges/:challengeId/publish`         | Publish definition.                                                                   |
| `POST`   | `/admin/challenges/:challengeId/archive`         | Archive definition globally.                                                          |
| `DELETE` | `/admin/challenges/:challengeId`                 | Delete eligible custom definition.                                                    |
| `GET`    | `/admin/challenges/:challengeId/progress`        | Paginated progress list.                                                              |
| `POST`   | `/admin/challenges/:challengeId/test-validation` | Execute validator for an admin-selected user without normal submission orchestration. |

Custom creation accepts only `static_secret` and `manual_review` validation. Curated definitions are seeded from source control.

## Admin review routes

| Method | Path                                                               | Purpose                                                   |
| ------ | ------------------------------------------------------------------ | --------------------------------------------------------- |
| `GET`  | `/admin/challenges/:challengeId/submissions`                       | List submissions; supports status and instance filters.   |
| `POST` | `/admin/challenges/:challengeId/submissions/:submissionId/approve` | Accept pending review and complete/reward.                |
| `POST` | `/admin/challenges/:challengeId/submissions/:submissionId/reject`  | Reject pending review and return progress to active work. |

Review bodies may contain a `message` string.

## Admin instance routes

| Method   | Path                                             | Purpose                                                |
| -------- | ------------------------------------------------ | ------------------------------------------------------ |
| `GET`    | `/admin/reward-integrations`                     | List every database-backed instance.                   |
| `POST`   | `/admin/reward-integrations`                     | Create and live-verify an instance.                    |
| `GET`    | `/admin/reward-integrations/:instanceId/members` | Read external roster plus AWS link status.             |
| `PUT`    | `/admin/reward-integrations/:instanceId`         | Update metadata, credentials, scopes, or active state. |
| `POST`   | `/admin/reward-integrations/:instanceId/test`    | Perform live roster connection check.                  |
| `DELETE` | `/admin/reward-integrations/:instanceId`         | Deactivate without deleting history.                   |

Create body:

```json
{
  "name": "CSC 1100 - Fall 2026 - Section 002",
  "description": "Monday section",
  "apiBaseUrl": "https://www.prizeversity.com",
  "apiKey": "<classroom-scoped-key>",
  "classroomId": "<prizeversity-classroom-id>",
  "scopes": ["users:read", "users:match", "reward:grant"],
  "active": true
}
```

The full API key is never included in instance responses.

## Admin assignment routes

| Method   | Path                                                                         | Purpose                                                |
| -------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| `GET`    | `/admin/reward-integrations/:instanceId/challenge-assignments`               | List assignments and progress summaries.               |
| `POST`   | `/admin/reward-integrations/:instanceId/challenge-assignments`               | Assign one published catalog definition.               |
| `PATCH`  | `/admin/reward-integrations/:instanceId/challenge-assignments/:assignmentId` | Update status, dates, attempts, or reward.             |
| `DELETE` | `/admin/reward-integrations/:instanceId/challenge-assignments/:assignmentId` | Delete unused assignment or archive one with progress. |

Create/update body:

```json
{
  "challengeId": "<catalog-definition-id>",
  "status": "published",
  "startsAt": "2026-09-08T13:00:00.000Z",
  "endsAt": "2026-09-22T03:59:59.000Z",
  "maxAttempts": 3,
  "reward": {
    "enabled": true,
    "bits": 50,
    "xpMode": "custom",
    "xpAmount": 30,
    "applyGroupMultipliers": true,
    "applyPersonalMultipliers": true
  }
}
```

Use `null` to clear dates. A missing field leaves the existing value unchanged during update.

## Challenge error codes

| Code                             | Meaning                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| `CHALLENGE_NOT_FOUND`            | Missing definition or challenge unavailable to this classroom. |
| `CHALLENGE_NOT_PUBLISHED`        | Assignment operation requires a published definition.          |
| `REWARD_LINK_REQUIRED`           | User lacks the required active instance link.                  |
| `MAX_ATTEMPTS_REACHED`           | Assignment attempt limit exhausted.                            |
| `VALIDATOR_ERROR`                | Validator could not execute safely.                            |
| `CHALLENGE_DELETE_BLOCKED`       | Definition has protected source, status, or assignments.       |
| `CHALLENGE_ASSIGNMENT_NOT_FOUND` | Assignment is missing from the specified instance.             |
| `CHALLENGE_ASSIGNMENT_EXISTS`    | Definition already assigned to that instance.                  |
| `SUBMISSION_NOT_FOUND`           | Submission or related progress/user is missing.                |
| `SUBMISSION_NOT_REVIEWABLE`      | Submission is not currently pending review.                    |
| `INVALID_CHALLENGE_INPUT`        | Request fields violate domain validation.                      |
