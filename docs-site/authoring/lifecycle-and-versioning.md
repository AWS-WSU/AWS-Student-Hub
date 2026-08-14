# Lifecycle and versioning

Definitions and assignments have separate lifecycles. Treat their status fields independently.

## Definition lifecycle

| Status      | Meaning                                                                       |
| ----------- | ----------------------------------------------------------------------------- |
| `draft`     | Editable catalog record that cannot be assigned or shown to students.         |
| `published` | Available in the catalog picker and eligible for student-visible assignments. |
| `archived`  | Retained for history but suppresses every assignment from student visibility. |

Publishing records the first publication time. Archiving records an archive time. Republishing clears the archive marker while retaining the original publication time.

## Assignment lifecycle

| Status      | Meaning                                                                           |
| ----------- | --------------------------------------------------------------------------------- |
| `draft`     | Classroom configuration exists but students cannot see it.                        |
| `published` | Eligible for visibility when the instance, definition, and date window are valid. |
| `archived`  | Hidden from students while preserving classroom history.                          |

An inactive instance prevents assignment creation/publication and student visibility even if the assignment says `published`.

## Version semantics

`Challenge.version` identifies the validation revision of a catalog definition.

The current implementation increments the version when the definition's validation configuration changes. It does **not** increment for every title, instruction, difficulty, or default-reward edit.

`ChallengeAssignment.challengeVersion` records the definition version observed when the assignment was created or last updated. `ChallengeProgress.challengeVersion` records the definition version when that progress record began.

These fields support diagnosis and future migrations. They do not freeze an old validator implementation or old instructions for an active student.

::: warning Not immutable snapshots
Assignments and progress retain version numbers, not complete copies of definition content and validation. Editing a published definition can affect existing assignments immediately.
:::

## Safe edits

Usually safe during an active run:

- Correcting spelling
- Clarifying instructions without changing the solution
- Updating tags or estimated time
- Adjusting one classroom's schedule, attempts, hint, or rewards through its assignment

Require testing and coordination:

- Changing validation configuration
- Changing a static secret
- Changing personalized derivation logic
- Changing a specialized route key
- Reinterpreting what counts as completion

For a breaking change, create a new definition with a new key and slug. Assign it deliberately rather than silently changing the rules for students already in progress.

## Global versus classroom changes

| Desired change                               | Change this record        |
| -------------------------------------------- | ------------------------- |
| Fix instructions for every class             | Catalog definition        |
| Change reward for one section                | Classroom assignment      |
| Close one section early                      | Classroom assignment      |
| Add guidance for one section                 | Classroom assignment      |
| Stop the challenge everywhere                | Catalog definition status |
| Stop all challenges for one classroom        | Instance status           |
| Change the validator for future cohorts only | New catalog definition    |

## Archival policy

Prefer archival over deletion once students have interacted with an assignment. Historical progress needs the definition, assignment, user, and reward references to remain interpretable.

Removing an assignment with no progress deletes it. Removing one with progress archives it automatically.

Custom definitions may be deleted only after archival and complete removal from every classroom. Curated definitions remain source-controlled and cannot be deleted through the admin API.
