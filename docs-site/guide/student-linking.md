# Student account linking

Account linking verifies one Prizeversity identity and records every configured classroom in which that identity is a member. Classroom memberships determine which challenge assignments the student can see and where each completion reward is delivered.

## What is linked

One AWS Student Hub user has one verified Prizeversity identity and may have multiple classroom memberships. The identity records the Prizeversity user ID, email, display name, short ID, and initial verification time. Each membership separately records:

- AWS reward integration instance
- Prizeversity classroom ID
- Prizeversity member identity observed in that roster
- Active or disconnected state
- Initial connection and latest roster-verification timestamps

A student does not replace an old classroom when joining another one. The student adds the new classroom connection, and progress remains isolated by classroom assignment.

## Student workflow

1. Sign in to AWS Student Hub.
2. Open **Account Settings** and find **Prizeversity Rewards**.
3. Select the correct reward classroom when multiple instances are available.
4. Enter a Prizeversity email, exact full name, short ID, or user ID. Leaving the field blank makes AWS Student Hub try the student's own account details.
5. Select **Send code** for the first classroom.
6. Retrieve the six-digit code from the email address stored on the matched Prizeversity account.
7. Enter the code to verify the identity and connect the classroom.
8. To add another class, join it in Prizeversity, return to Account Settings, select the additional classroom, and choose **Connect classroom**.

The code expires after 10 minutes. Five incorrect attempts invalidate the pending request and require a new code.

After the first successful verification, an additional classroom can connect without another code only when its roster resolves to the same Prizeversity user ID. A different identity is rejected rather than silently replacing the verified account.

## Why email verification is required

Identifiers such as a short ID or email address are discoverable and do not prove account ownership. AWS Student Hub therefore resolves the member first, then sends the code to the email already attached to that Prizeversity record.

The code is stored only as a salted SHA-256 hash. A new request replaces the previous pending request for that AWS user.

## Matching behavior

AWS Student Hub first reads the selected classroom roster and looks for an exact case-insensitive match against user ID, short ID, email, or full name. If roster lookup does not produce a match, it falls back to Prizeversity's user-matching endpoint using the supplied identifier and the AWS user's account data.

The selected instance determines the classroom searched. A valid member in another classroom is not a valid match. The student must first join the exact Prizeversity classroom represented by that instance.

For example, membership in `CIS Test2` cannot satisfy an AWS Student Hub instance configured for `CIS Test`, even when both classrooms belong to the same instructor.

## Membership lifecycle

AWS Student Hub periodically rechecks each connected membership against its Prizeversity classroom roster.

- Joining a new class does not connect it automatically; the student explicitly adds the configured classroom in Account Settings.
- Leaving one class marks only that membership inactive after revalidation. The student's other classrooms continue working.
- Rejoining an available class allows the student to reconnect it using the same verified identity.
- Leaving every class does not erase the verified identity, progress, submissions, or reward history.
- **Disconnect classroom** disables one membership by user choice.
- **Remove identity and all classrooms** clears the identity and every membership, requiring email verification again later.

Challenge detail, progress, attempts, and rewards are resolved by assignment ID. If the same catalog challenge is assigned to two classrooms, each assignment has independent progress and uses that classroom's API credentials.

## Required email state

The matched Prizeversity account must have an email address. Linking cannot be completed for an account without one because there is no ownership-verification destination.

SMTP must also be correctly configured on the AWS Student Hub backend. A successful Prizeversity match followed by an email delivery failure is reported separately from “no member found.”

## Disconnecting and removing identity

Use **Disconnect classroom** when a student should stop using one class but retain other classroom connections. Use **Remove identity and all classrooms** only when the entire Prizeversity identity is wrong or must be replaced.

Neither action erases completed challenge progress or reverses rewards already sent. A disconnected classroom no longer contributes visible assignments and cannot receive new rewards.

## Instructor diagnosis

When a student cannot link, check in this order:

1. Confirm the intended instance is active.
2. Run **Check connection**.
3. Find the member in the instance's **Students** tab. Similar classroom names are not interchangeable.
4. Confirm the member has a valid email address.
5. Confirm the student selected the exact classroom they joined in Prizeversity.
6. Ask for the exact Prizeversity email or short ID, not a nickname.
7. If the message says email delivery failed, inspect backend SMTP configuration rather than changing the member identifier.

::: warning Never bypass ownership verification casually
The backend contains an internal direct-link service for compatibility, but the public account route uses the verification-code workflow. Do not add an admin “link by ID” shortcut without an explicit authorization and audit design.
:::
