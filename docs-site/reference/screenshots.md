# Screenshot maintenance

Screenshots are generated documentation assets, not the source of truth. Every operation shown in an image must also be described in text.

## Why capture automatically

The Playwright capture project provides repeatable viewport, theme, masking, and file paths. It avoids hand-cropped screenshots containing personal accounts, API keys, notifications, or browser chrome.

## Safety rules

- Use a local application and a disposable fixture database.
- Never run documentation capture against production.
- Use fake student names, emails, classroom IDs, balances, and API key previews.
- Never submit a real reward during capture.
- Keep generated authentication state under `.auth/`; it is ignored by Git.
- Review every generated image before committing it.

The capture configuration rejects non-local origins unless `DOCS_CAPTURE_ALLOW_REMOTE=true` is set intentionally. That override exists for controlled preview environments, not production.

## Required fixture state

The admin fixture should have:

- Completed onboarding and policy acknowledgement
- `admin` or `superuser` role
- One active, verified fake reward instance
- At least two fake roster members
- One published catalog definition
- One draft and one published classroom assignment
- One manual-review submission if review screenshots are needed

The student fixture is optional and should be linked only to the fake instance.

## Environment variables

```bash
export DOCS_APP_URL='http://127.0.0.1:5173'
export DOCS_ADMIN_IDENTIFIER='docs-admin@example.test'
export DOCS_ADMIN_PASSWORD='local-fixture-password'
```

Optional student capture:

```bash
export DOCS_STUDENT_IDENTIFIER='docs-student@example.test'
export DOCS_STUDENT_PASSWORD='local-fixture-password'
```

## Capture

Start the local frontend and backend with the fixture database, then run:

```bash
bun run capture:docs
```

The capture suite writes reviewed assets to `docs-site/public/screenshots`. It masks API key previews, classroom IDs, emails, and user-specific values before capture.

Install the browser once when needed:

```bash
bun run --cwd docs-site capture:install
```

## Selecting screenshots

Prefer an element screenshot when documenting one workflow. Current targets are:

- Instance workspace overview
- Classroom challenge assignment list
- Catalog picker
- Student roster
- Prizeversity account-link panel

Avoid full-page captures of long dashboards. They age quickly, contain unrelated state, and are unreadable on mobile documentation layouts.

## Updating documentation

When UI changes:

1. Update the written workflow first if behavior changed.
2. Reset the fixture database to deterministic state.
3. Run the capture suite.
4. Compare image changes manually.
5. Confirm every masked region is still covered.
6. Commit only images referenced by a documentation page.

If a selector breaks while behavior remains unchanged, update the capture test without rewriting the conceptual documentation.
