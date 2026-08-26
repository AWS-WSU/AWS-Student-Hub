# Reviews and rewards

Challenge validation decides whether a submission is rejected, accepted immediately, or queued for instructor review. Reward delivery begins only after completion is accepted.

## Automatic validation

`static_secret` and curated automatic validators complete the challenge as soon as the submitted proof is accepted.

For every submission, AWS Student Hub:

1. Creates or loads progress for the student and assignment.
2. Enforces the assignment's attempt limit.
3. Increments the attempt count.
4. Runs the definition's validator.
5. Stores a sanitized submission record.
6. Completes progress when accepted.
7. Sends the assignment's reward when enabled.

Secrets, passwords, tokens, and keys are redacted from submission previews.

## Manual review

A `manual_review` validator accepts proof text or a link, then changes progress to `pending_review` without completing the challenge.

From the instance's challenge list, open the pending review queue. Review the evidence and select:

- **Approve:** marks the submission accepted, completes progress, and attempts reward delivery.
- **Reject:** marks the submission rejected and returns progress to `in_progress` so the student can submit again.

Rejection does not refund an attempt. The attempt was consumed when the proof was submitted.

Review the queue from the relevant instance so submissions from separate classes remain operationally distinct.
The backend returns and permits decisions only for submissions belonging to instances created by the
signed-in instructor. Superusers do not receive an implicit cross-classroom review view.

## Reward configuration

The assignment controls the actual reward sent for that classroom.

| Setting              | Behavior                                                    |
| -------------------- | ----------------------------------------------------------- |
| Enabled              | Whether completion invokes Prizeversity.                    |
| Bits                 | Base bits included in the reward request.                   |
| XP mode `none`       | No completion XP.                                           |
| XP mode `classroom`  | Prizeversity applies classroom XP behavior.                 |
| XP mode `custom`     | The assignment supplies a fixed XP amount.                  |
| Group multipliers    | Allows configured classroom/group effects.                  |
| Personal multipliers | Allows configured member effects.                           |
| Stats                | Optional multiplier, luck, shield, or discount adjustments. |

## Completion states

| Progress state   | Meaning                                                       |
| ---------------- | ------------------------------------------------------------- |
| `in_progress`    | Started or eligible to submit again.                          |
| `pending_review` | Waiting for an admin decision.                                |
| `completed`      | Accepted and no external reward was required.                 |
| `reward_pending` | Completion recorded and reward processing started.            |
| `reward_sent`    | Prizeversity accepted the reward or it had already been sent. |
| `reward_failed`  | Completion was accepted, but Prizeversity delivery failed.    |

## Duplicate protection

Reward emission is unique for the combination of AWS user, Prizeversity classroom, and challenge key. If a sent emission already exists, AWS Student Hub returns `already_sent` rather than issuing the reward twice.

This protection applies across repeated submissions and repeated completion handling for the same challenge in the same classroom.

## Failed rewards

A failed Prizeversity request is stored with status `failed` and its error message. Student progress becomes `reward_failed`; the challenge remains completed and cannot be solved repeatedly to trigger new rewards.

::: warning Current recovery boundary
The admin UI does not currently provide a retry action for failed challenge rewards. Resolve the API key, instance, classroom, or Prizeversity outage first, then escalate the failed emission to a developer for controlled replay. Do not manually grant a second reward without checking the emission record.
:::

## What is authoritative

AWS Student Hub is authoritative for challenge attempts, submission review, and whether reward delivery was attempted. Prizeversity is authoritative for the resulting bits, XP, balance, and level shown in the classroom roster.
