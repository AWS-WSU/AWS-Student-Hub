# Prizeversity instances

A reward integration instance is AWS Student Hub's server-side representation of one Prizeversity classroom.

## One instance per classroom

Create a separate instance whenever Prizeversity has a separate classroom. Examples include:

- Different course sections
- Different semesters
- A sandbox or QA classroom
- A workshop with its own roster and rewards

Two sections may assign the same catalog challenge, but they should not share an instance unless they intentionally share one Prizeversity roster and economy.

## Instance fields

| Field           | Meaning                                                                               |
| --------------- | ------------------------------------------------------------------------------------- |
| Instance name   | Internal label used by AWS Student Hub admins.                                        |
| Description     | Operational notes about the class or purpose.                                         |
| API base URL    | Prizeversity host. Enter the host, not an individual integration endpoint.            |
| Classroom ID    | External Prizeversity classroom identifier.                                           |
| Classroom label | Human-readable label; live verification may replace it with Prizeversity's value.     |
| API key         | Classroom-scoped integration credential sent as `X-API-Key`.                          |
| Scopes          | Capabilities expected from that key.                                                  |
| Active          | Whether linking, assignment publication, student visibility, and rewards are allowed. |

The default base URL is `https://www.prizeversity.com`. AWS Student Hub normalizes pasted URLs and removes a trailing `/api/integrations/...` path, but instructors should still enter only the base host.

## Required scopes

The current integration expects:

| Scope          | Used for                                                   |
| -------------- | ---------------------------------------------------------- |
| `users:read`   | Connection tests and the classroom roster.                 |
| `users:match`  | Matching an AWS Student Hub user to a Prizeversity member. |
| `reward:grant` | Sending challenge bits, XP, and configured stat changes.   |

Scope names stored in AWS Student Hub describe the expected contract. Prizeversity remains responsible for enforcing the API key's actual scopes.

## What Check connection does

**Check connection** sends an authenticated request for the configured classroom roster. On success, AWS Student Hub updates:

- Last verification timestamp
- Verification status
- Classroom name
- Last observed user count

It does not grant a reward, match a particular student, alter the roster, or prove that SMTP is configured for account-link emails.

A successful check proves the key can read the configured classroom. It does not prove `users:match` fallback or `reward:grant`; verify those through a controlled account-link and completion test before the class begins.

## Student roster

The **Students** tab reads the current roster from Prizeversity. Balance, level, and XP values shown there come from Prizeversity rather than an AWS Student Hub wallet.

For each Prizeversity member, AWS Student Hub also reports whether an AWS account is linked to that Prizeversity user ID in this instance.

## Updating credentials

Use **Settings** to rotate an API key or correct the classroom ID. Changing the base URL, API key, or classroom ID triggers a fresh connection test before the update is accepted.

Leave the API key field blank when changing unrelated metadata. The existing key remains stored server-side.

## Deactivation

Deactivating an instance:

- Prevents new challenge assignments from being created or published
- Removes its assigned challenges from linked students
- Prevents it from being selected for new account links
- Prevents normal reward delivery through that instance

It does not delete assignments, student links, submissions, progress, or prior reward emissions. Reactivation restores eligibility, subject to assignment status and dates.

## Environment fallback

The backend can expose one legacy environment-configured instance through `PRIZEVERSITY_API_URL`, `PRIZEVERSITY_API_KEY`, and `PRIZEVERSITY_CLASSROOM_ID` when no active database instances exist.

Database-backed instances are the supported multi-classroom administration model. Environment-configured instances cannot be edited in the dashboard and should be treated as a compatibility fallback, not the normal semester workflow.
