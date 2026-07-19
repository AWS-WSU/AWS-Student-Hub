# Student account linking

Account linking establishes which Prizeversity classroom and member receive a student's challenge rewards. It is also the boundary used to determine which challenge assignments the student can see.

## What is linked

One AWS Student Hub user can have one active Prizeversity link at a time. The link records:

- AWS reward integration instance
- Prizeversity classroom ID
- Prizeversity user ID
- Prizeversity email, display name, and short ID when available
- Initial link and latest synchronization timestamps

A student who changes sections must unlink the old account and link to the new instance.

## Student workflow

1. Sign in to AWS Student Hub.
2. Open **Account Settings** and find **Prizeversity Rewards**.
3. Select the correct reward classroom when multiple instances are available.
4. Enter a Prizeversity email, exact full name, short ID, or user ID. Leaving the field blank makes AWS Student Hub try the student's own account details.
5. Select **Send code**.
6. Retrieve the six-digit code from the email address stored on the matched Prizeversity account.
7. Enter the code to complete the link.

The code expires after 10 minutes. Five incorrect attempts invalidate the pending request and require a new code.

## Why email verification is required

Identifiers such as a short ID or email address are discoverable and do not prove account ownership. AWS Student Hub therefore resolves the member first, then sends the code to the email already attached to that Prizeversity record.

The code is stored only as a salted SHA-256 hash. A new request replaces the previous pending request for that AWS user.

## Matching behavior

AWS Student Hub first reads the selected classroom roster and looks for an exact case-insensitive match against user ID, short ID, email, or full name. If roster lookup does not produce a match, it falls back to Prizeversity's user-matching endpoint using the supplied identifier and the AWS user's account data.

The selected instance determines the classroom searched. A valid member in another classroom is not a valid match.

## Required email state

The matched Prizeversity account must have an email address. Linking cannot be completed for an account without one because there is no ownership-verification destination.

SMTP must also be correctly configured on the AWS Student Hub backend. A successful Prizeversity match followed by an email delivery failure is reported separately from “no member found.”

## Unlinking

Students can unlink from the connected panel in Account Settings. Unlinking removes the AWS-to-Prizeversity identity fields and any pending verification request.

Unlinking does not erase completed challenge progress or reverse rewards already sent. Until another account is linked, the student sees no classroom-assigned challenges.

## Instructor diagnosis

When a student cannot link, check in this order:

1. Confirm the intended instance is active.
2. Run **Check connection**.
3. Find the member in the instance's **Students** tab.
4. Confirm the member has a valid email address.
5. Confirm the student selected the correct classroom.
6. Ask for the exact Prizeversity email or short ID, not a nickname.
7. If the message says email delivery failed, inspect backend SMTP configuration rather than changing the member identifier.

::: warning Never bypass ownership verification casually
The backend contains an internal direct-link service for compatibility, but the public account route uses the verification-code workflow. Do not add an admin “link by ID” shortcut without an explicit authorization and audit design.
:::
