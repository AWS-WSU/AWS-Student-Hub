# Custom challenges

Admins can author `static_secret` and `manual_review` definitions from **Admin Dashboard > Challenges > Create custom challenge**. The Challenges tab manages the global **Challenge catalog**.

New custom definitions begin as drafts. Publishing makes them selectable from classroom catalogs but does not expose them directly to students.

## Shared fields

| Field             | Guidance                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Title             | Student-facing name. Keep it stable once assigned.                                                      |
| Key               | Stable internal identity using lowercase letters, numbers, `_`, or `-`.                                 |
| Slug              | Student URL segment using lowercase letters, numbers, and `-`.                                          |
| Summary           | One-sentence catalog and challenge-card description.                                                    |
| Description       | Learning context and expected outcome.                                                                  |
| Instructions      | Concrete steps and proof format without disclosing the answer.                                          |
| Kind              | `single` for current custom validators; reserve `multi_part` for an implemented multi-stage experience. |
| Difficulty        | `easy`, `medium`, `hard`, or `expert`.                                                                  |
| Estimated minutes | Planning estimate, not an enforced timer.                                                               |
| Tags              | Search and categorization labels.                                                                       |
| Maximum attempts  | Definition default copied into new assignments.                                                         |
| Reward            | Definition default copied into new assignments.                                                         |

Keys and slugs must be globally unique.

## Static secret configuration

Apply the **Static secret** template, then replace the placeholder answer.

```json
{
  "type": "static_secret",
  "expectedValue": "replace-with-secret-answer",
  "trimSubmission": true,
  "caseSensitive": true
}
```

The backend converts `expectedValue` into `expectedValueHash` before saving. The plaintext expected value is not returned in the admin challenge record.

### Options

| Property            | Default                            | Meaning                                                                       |
| ------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| `expectedValue`     | Required unless a hash is supplied | Plaintext answer accepted only during creation/update and hashed for storage. |
| `expectedValueHash` | None                               | Precomputed SHA-256 hash for advanced authoring.                              |
| `trimSubmission`    | `true`                             | Ignores surrounding whitespace.                                               |
| `caseSensitive`     | `true`                             | Preserves case when hashing and comparing.                                    |
| `acceptedPrefixes`  | `['next_password=']`               | Removes a recognized prefix before comparison.                                |

If case-insensitive comparison is enabled, hash values must be generated from the lowercase normalized answer.

::: warning Keep answers server-side
Do not place the plaintext answer in instructions, frontend components, public assets, or screenshots. Hashing the validator record does not protect an answer embedded elsewhere.
:::

## Manual review configuration

Apply the **Manual review** template.

```json
{
  "type": "manual_review",
  "minLength": 20,
  "maxLength": 2000,
  "submittedMessage": "Submission received for review."
}
```

Students may submit proof text or a URL. `minLength` and `maxLength` apply to proof text when present. A URL-only submission is accepted into the review queue.

Use the submitted message to set expectations, such as the normal review timeframe. Do not imply completion or reward before approval.

## Reward defaults

Reward fields on the definition are templates for new assignments. Set reasonable defaults, but verify each classroom assignment before publishing.

The custom challenge form currently selects custom XP when an XP amount is supplied and no XP otherwise. Classroom XP mode and advanced stats can be adjusted through assignment configuration or the API contract.

## Authoring workflow

1. Create the definition as a draft.
2. Review all student-facing text in the resulting catalog card.
3. Confirm the validation JSON has no placeholder values.
4. Publish the definition.
5. Assign it to a sandbox instance as draft.
6. Configure the classroom reward and attempts.
7. Publish the sandbox assignment and test with a designated account.
8. Assign the same definition to production classrooms.

## Updating a custom definition

Changing validation increments the challenge version. Text and default reward edits currently do not increment it.

Validation changes apply to every assignment referencing the definition. For a materially different answer or assessment, prefer a new definition and slug rather than changing a challenge while students are actively working.

## Deletion

Custom definitions must be archived and unassigned everywhere before deletion. If an assignment has student progress, that assignment is archived rather than removed, so the definition should generally remain archived for historical integrity.
