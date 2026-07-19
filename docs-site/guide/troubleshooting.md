# Troubleshooting

Start with the visible symptom, then verify the instance, account link, definition, and assignment in that order.

## Quick diagnosis

| Symptom                             | Likely cause                                                                | Action                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Instance creation fails             | Wrong key, classroom ID, base URL, or missing `users:read`                  | Correct the Prizeversity configuration and retry creation.                       |
| Check connection fails              | Expired/deactivated key, wrong classroom, Prizeversity unavailable          | Inspect the stored failure message and verify the key in Prizeversity.           |
| Student cannot find their account   | Wrong instance or non-exact roster data                                     | Confirm the selected classroom and exact email, full name, short ID, or user ID. |
| Match succeeds but no code arrives  | Missing Prizeversity email or SMTP failure                                  | Confirm the roster email; inspect backend email logs and SMTP configuration.     |
| Code is rejected                    | Expired code, replaced request, or five failed attempts                     | Request a new code and use only the latest email.                                |
| Student sees no challenges          | Missing/inactive link, instance, definition, assignment, or date window     | Work through the visibility checklist below.                                     |
| Correct answer is rejected          | Wrong validator configuration, case setting, prefix, or personalized secret | Test the definition and inspect sanitized submission status.                     |
| Submission stays pending            | Manual review required                                                      | Open the classroom assignment's review queue.                                    |
| Reward is missing                   | Reward disabled, link mismatch, failed Prizeversity request                 | Inspect progress status and reward emission before granting anything manually.   |
| Challenge cannot be removed         | Student progress exists                                                     | Archive the assignment; historical activity is intentionally retained.           |
| Custom definition cannot be deleted | It is published or still assigned                                           | Archive the definition and remove all assignments first.                         |

## Student visibility checklist

Confirm all six conditions:

1. The student is linked to the intended instance.
2. The instance is active.
3. The catalog definition is published.
4. The definition is assigned to that instance.
5. The assignment is published.
6. The assignment is inside its opening and closing window.

The API intentionally returns “not found” for a challenge outside the student's classroom rather than exposing another classroom's configuration.

## Connection errors

### `401` or `403` from Prizeversity

The API key is invalid, inactive, or missing a required scope. Rotate or reissue the classroom-scoped key, then update the instance and run **Check connection**.

### `404` or HTML `Cannot GET ...`

Confirm the instance base URL contains only the Prizeversity host. Do not store `/api/integrations/reward` or another full endpoint as the base URL.

### Timeout

AWS Student Hub aborts Prizeversity requests after 12 seconds. Confirm external availability and networking before changing classroom data.

## Account-link email errors

If the UI reports that a Prizeversity match was found but the email could not be sent, matching is not the problem. Verify backend `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and encryption settings.

For Gmail, `SMTP_PASS` must contain the complete app password. Avoid surrounding quotes or accidentally storing a placeholder.

## Reward failures

Before correcting a missing reward manually, collect:

- AWS user ID
- Prizeversity user and classroom IDs
- Challenge key and assignment ID
- Progress status
- Reward emission ID and status
- Stored error message

Check whether a `sent` emission already exists. The external balance should be reconciled against Prizeversity before any controlled replay.

## Escalation information

When escalating to a developer, include the operation, UTC timestamp, instance name, challenge key, HTTP status, and request ID from backend logs. Never include the full API key, SMTP password, JWT, static-secret answer, or student verification code.
