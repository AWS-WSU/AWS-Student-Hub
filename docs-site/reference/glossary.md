# Glossary

## Assignment

The classroom-specific record connecting one catalog definition to one Prizeversity instance. Owns status, dates, attempts, and rewards.

## Bits

Prizeversity reward currency sent by AWS Student Hub after accepted challenge completion.

## Catalog definition

Reusable global challenge content and validation stored as `Challenge`.

## Challenge key

Stable internal identifier used in progress and reward idempotency. Unlike a title, it should not be casually changed.

## Curated challenge

A source-controlled definition with supporting code or assets. Curated definitions cannot be deleted through the admin dashboard.

## Custom challenge

A dashboard-authored definition using `static_secret` or `manual_review` validation.

## Definition status

Global draft, published, or archived lifecycle. A non-published definition suppresses every classroom assignment.

## Emission

The local ledger record for one outbound Prizeversity reward request.

## Instance

AWS Student Hub's server-side connection to one Prizeversity classroom, including classroom ID and API key.

## Manual review

Validation outcome in which proof is stored as pending until an admin approves or rejects it.

## Progress

Current challenge state for one AWS user and one classroom assignment.

## Prizeversity link

Verified mapping from one AWS user to one Prizeversity member and reward instance.

## Published

Eligible for use, not automatically visible. Student visibility still requires an active link, instance, definition, assignment, and availability window.

## Reward instance

Synonym for Prizeversity instance or `RewardIntegrationInstance`.

## Slug

Stable, URL-safe student route identity for a catalog definition.

## Static secret

Automatic validator that compares a normalized submitted value to a stored SHA-256 hash.

## Submission

Append-only record of one validation attempt, including sanitized proof preview and outcome.

## Version

Current validation revision of a catalog definition. The current implementation increments it when validation configuration changes, not for every content edit.
