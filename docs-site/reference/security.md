# Security boundaries

The challenge system handles classroom credentials, student identity links, hidden answers, and external rewards. Security depends on keeping those concerns server-side and scoped to the correct instance.

## RBAC

Role order:

```text
member < moderator < admin < superuser
```

Challenge catalog, assignment, reward-instance, roster, and manual-review routes require at least `admin`. Superusers satisfy that requirement automatically.

The middleware reloads role and account status from MongoDB for each admin request rather than trusting a role embedded in the browser state.

::: warning Global admin scope
All admins currently manage all instances. There is no instructor-to-instance ACL. Treat admin membership as organization-wide challenge administration.
:::

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

Challenge access is derived from the user's stored instance ID. Services query assignments using that instance and do not accept a classroom ID supplied by the student.

Reward delivery verifies that the assignment instance matches the user's linked instance before selecting credentials and classroom ID.

## Validation and proof handling

Submission payloads enter services as `unknown` and must be narrowed by validators. Validators generate a sanitized payload preview before persistence.

The generic sanitizer redacts field names containing secret, password, token, or key. Specialized validators should be stricter and avoid storing reconstructable proof where it is unnecessary.

For `static_secret`, plaintext expected values are normalized and hashed before the definition is stored. Student submissions are compared as hashes. This protects the database record from casually exposing the answer, but it does not compensate for weak or guessable secrets.

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
