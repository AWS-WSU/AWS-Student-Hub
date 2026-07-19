# Reward delivery

Reward delivery is a server-to-server Prizeversity integration. The browser submits challenge proof to AWS Student Hub; it never calls Prizeversity with an API key.

## Outbound authentication

Every Prizeversity request includes:

```http
X-API-Key: <instance-api-key>
Content-Type: application/json
```

The full key is loaded only from a database query that explicitly selects it, or from the legacy environment fallback. Requests time out after 12 seconds.

## Integration endpoints

AWS Student Hub uses three Prizeversity operations.

### Classroom roster

```http
GET /api/integrations/users/list/:classroomId?fields=extended
```

Used for instance verification, roster display, and exact account matching.

### User match fallback

```http
POST /api/integrations/users/match
```

```json
{
  "classroomId": "<classroom-id>",
  "users": [
    {
      "name": "student identifier",
      "email": "aws-account@example.edu",
      "awsUserId": "<aws-user-id>",
      "candidateIndex": 0
    }
  ]
}
```

Used when exact roster matching does not resolve an account.

### Reward grant

```http
POST /api/integrations/reward
```

```json
{
  "classroomId": "<classroom-id>",
  "userId": "<prizeversity-user-id>",
  "activityName": "AWS Cloud Security Lab",
  "description": "Completed AWS Cloud Security Lab",
  "bits": 50,
  "stats": {
    "multiplier": 0.2,
    "luck": 0.1,
    "shield": 1
  },
  "completionXP": {
    "mode": "custom",
    "xpAmount": 30
  },
  "applyGroupMultipliers": true,
  "applyPersonalMultipliers": true
}
```

The classroom comes from the assignment's reward instance. The recipient comes from the student's verified link. A mismatch between the student's linked instance and the assignment instance is rejected before sending.

## Completion orchestration

When validation or manual approval accepts a challenge:

1. Progress receives `completedAt` and a stable completion event ID.
2. Rewardable progress changes to `reward_pending`.
3. The assignment's reward is translated into the Prizeversity payload.
4. AWS Student Hub loads or creates a reward emission ledger record.
5. Prizeversity is called.
6. Success stores the response and changes progress to `reward_sent`.
7. Failure stores the error and changes progress to `reward_failed`.
8. A disabled reward changes progress to `completed` without an external call.

## Idempotency

`RewardIntegrationEmission` has a unique index on:

```text
awsUserId + classroomId + challengeKey
```

If a matching emission is already `sent`, reward delivery returns `alreadySent: true` with the prior response. This prevents duplicate grants after repeated requests or completion handling.

The completion event ID is separately unique by user and assignment:

```text
challenge-completed:<aws-user-id>:<assignment-id>
```

## Failure behavior

Failed emissions remain available for diagnosis and can be attempted again by lower-level reward service logic. However, completed challenge submission handling returns the existing `reward_failed` state and the admin UI currently has no controlled replay endpoint.

A production replay mechanism should:

- Require admin authorization.
- Lock or atomically claim the emission.
- Reconcile Prizeversity state before retrying ambiguous timeouts.
- Preserve every attempt and external response.
- Reuse the same idempotency identity.

Until that exists, failed rewards require developer-assisted reconciliation.

## Observability fields

For a reward incident, correlate:

- `ChallengeProgress.completionEventId`
- `ChallengeProgress.rewardEmissionId`
- `RewardIntegrationEmission.status`
- `RewardIntegrationEmission.requestPayload`
- `RewardIntegrationEmission.responsePayload` or `errorMessage`
- Assignment and reward instance IDs
- Prizeversity classroom and user IDs

Do not log or expose the instance API key while diagnosing delivery.
