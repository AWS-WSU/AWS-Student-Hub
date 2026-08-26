# Security boundaries

The challenge system handles classroom credentials, student identity links, hidden answers, and external rewards. Security depends on keeping those concerns server-side and scoped to the correct instance.

## RBAC

Role order:

```text
member < moderator < admin < superuser
```

Challenge catalog, assignment, reward-instance, roster, and manual-review routes require at least `admin`. Superusers satisfy that requirement automatically.

The site-wide distinction between member, moderator, admin, and superuser is documented in [Roles and permissions](../guide/roles-and-permissions).

The middleware reloads role and account status from MongoDB for each admin request rather than trusting a role embedded in the browser state.

## Instructor ownership

The challenge catalog is shared across authorized instructors, but classroom operations are not.
`RewardIntegrationInstance.createdBy` is an immutable authorization boundary for both admins and
superusers. Instance lists, settings, connection tests, rosters, assignments, progress, submissions,
manual reviews, and reward completion handling are filtered server-side to that owner.

Supplying another instructor's instance, assignment, or submission ID does not grant access. These
requests return the same not-found response as a missing record so the API does not disclose whether
the foreign classroom exists. A superuser does not bypass classroom ownership through normal admin
routes; superuser-only role management remains a separate capability.

## API key handling

- Prizeversity keys are submitted over authenticated admin routes.
- Keys are stored on `RewardIntegrationInstance` and excluded from default Mongoose selection.
- Browser responses contain only `apiKeyPreview`.
- The key is attached as `X-API-Key` only by the backend request client.
- Updating unrelated settings does not require resubmitting the key.

The configured base URL is also security-sensitive because the backend sends credentials to it. Only use the trusted Prizeversity origin. A future hardening step should enforce an explicit host allowlist if multiple providers are not required.

## Account ownership

Knowing an external identifier is not sufficient to link an account. The public link flow sends a one-time code to the email already stored on the matched Prizeversity member.

Controls include:

- Six-digit cryptographically generated code
- Salted SHA-256 code storage
- Ten-minute expiry
- Five-attempt limit
- One pending request per AWS user
- Automatic deletion after completion or terminal failure
- Masked destination returned to the browser

SMTP availability is therefore part of the account-security boundary, not merely a notification feature.

## Classroom isolation

Challenge access is derived from persisted, roster-verified memberships. Services query assignments across those membership instance IDs and do not accept a classroom ID supplied by the student.

Student navigation carries an assignment ID when the same definition exists in multiple classes. The backend verifies that the assignment belongs to an active membership before loading progress. Reward delivery independently refreshes that exact membership, selects credentials from the assignment instance, and uses the classroom and Prizeversity user IDs stored on the membership. Instructor access to the same assignment and its student records independently requires ownership of that instance.

## Validation and proof handling

Submission payloads enter services as `unknown` and must be narrowed by validators. Validators generate a sanitized payload preview before persistence.

The generic sanitizer redacts field names containing secret, password, token, or key. Specialized validators should be stricter and avoid storing reconstructable proof where it is unnecessary.

For `static_secret`, plaintext expected values are normalized and hashed before the definition is stored. Student submissions are compared as hashes. This protects the database record from casually exposing the answer, but it does not compensate for weak or guessable secrets.

## Deliberately vulnerable labs

The SQL Injection Sandbox is vulnerable by design, but its SQL boundary is disposable and synthetic:

- A new in-memory database is created for every search request.
- The database contains no application, Prizeversity, credential, or student-profile data.
- The vulnerable query cannot reach MongoDB or any persistent SQL service.
- Stacked statements and control characters are rejected, input and output are bounded, and requests are rate-limited.
- Parser details and stacks are not returned to the student.
- The hidden flag is HMAC-derived for one user, assignment, challenge, and version.
- Final acceptance is performed by the backend validator using a timing-safe comparison.

Do not replace the in-memory adapter with a production database connection. Extending this challenge with persistent data or general-purpose SQL execution changes the security model and requires a separate isolation review.

The PCAP Forensics generator follows the same synthetic-data boundary. It uses documentation-range addresses, fixed fictional hostnames, and a per-student HMAC flag. Captures are generated only after assignment checks, are not stored server-side, and are returned with no-store caching. Never use real packet captures as challenge fixtures unless they have undergone a documented privacy and credential review.

## Browser trust boundary

The frontend is an untrusted presentation layer. A student can inspect JavaScript, network responses, hidden DOM, and public assets.

Never rely on:

- Obscure component names
- Client-only route guards
- Hidden buttons
- Minification
- Values embedded in frontend environment variables
- Client-computed success flags

Curated validators must decide acceptance on the backend.

## Public API documentation and challenge integrity

The HTTP reference documents the authenticated contract used by the AWS Student Hub frontend. It is not an anonymous challenge-authoring API and it does not contain stored answers, signing secrets, API keys, or student-specific solutions.

Knowing an endpoint or request shape is not an authorization bypass. Student routes still enforce the signed-in user, active account status, roster-verified Prizeversity membership, published classroom assignment, schedule, attempt limits, and backend validation. Admin routes independently reload the user's current role and require `admin` or `superuser`.

Public route documentation can reduce discovery work, so challenge integrity must never depend on an endpoint being unknown. If a challenge requires implementation details that would materially reveal its solution, keep those details in source-controlled internal notes rather than the public handbook.

## Logging and screenshots

Do not record or capture:

- Full Prizeversity API keys
- JWT access or refresh tokens
- SMTP passwords
- One-time verification codes
- Plaintext challenge answers
- AWS access keys
- Student email addresses in public documentation

Documentation screenshot tooling is restricted to local hosts by default and masks configured sensitive locators.

## External failure ambiguity

A network timeout may occur after Prizeversity processes a reward but before AWS Student Hub receives the response. The local emission becomes failed even though external state may have changed.

Always reconcile external state before manually replaying an ambiguous reward. Idempotency inside AWS Student Hub cannot guarantee that an external service did not process a timed-out request.
