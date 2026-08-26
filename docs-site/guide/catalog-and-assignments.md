# Catalog and assignments

The catalog is the reusable library. Assignments are the classroom-specific delivery records. Keeping these separate is what allows one challenge to serve many classes without mixing schedules, attempts, rewards, or progress.

## Catalog definitions

A definition contains:

- Stable key and URL slug
- Title, summary, description, and instructions
- Curated or custom source
- Draft, published, or archived status
- Difficulty, tags, and estimated time
- Validation configuration
- Default attempt and reward settings
- Version marker

Definitions are global. Editing one affects the content used by every assignment that references it.
Only instance owners can create or manage assignments for their classrooms.

## Classroom assignments

An assignment contains:

- Catalog definition ID and observed definition version
- Prizeversity instance ID
- Draft, published, or archived status
- Opening and closing dates
- Maximum attempts
- Concrete reward configuration
- Assignment and update audit fields

There can be only one assignment for a given definition and instance. Assigning the same challenge to a second classroom creates a separate assignment.

Assignment records and their progress summaries are visible only to the owner of the target instance,
even though the underlying definition is visible in the shared catalog.

## Assignment workflow

1. Publish the catalog definition.
2. Open **Reward Integrations** and select the target instance.
3. Open **Challenges** and select **Add from catalog**.
4. Choose a definition that is not already assigned to this instance.
5. Configure dates, attempts, reward, and assignment status.
6. Save as draft for verification or publish when ready.

A definition must remain published for a published assignment to be visible. Archiving the catalog definition suppresses all of its classroom assignments.

## Status behavior

| Definition | Assignment                   | Student result |
| ---------- | ---------------------------- | -------------- |
| Draft      | Any                          | Hidden         |
| Published  | Draft                        | Hidden         |
| Published  | Published and in window      | Visible        |
| Published  | Published but outside window | Hidden         |
| Published  | Archived                     | Hidden         |
| Archived   | Any                          | Hidden         |

An instance must also be active and linked to the student.

## Defaults and overrides

When an assignment is first created, it copies the definition's default dates, attempt limit, reward values, and current version. Those copied values belong to the assignment afterward.

Both the catalog create form and the assignment editor expose the full Prizeversity reward configuration: bits, completion XP mode (none, classroom default, or a custom amount), the activity name and description shown in the student's Prizeversity feed, stat adjustments (multiplier, luck, shield, discount), and the group/personal multiplier toggles. Leaving the activity name or description blank falls back to the challenge title; leaving a stat blank sends no adjustment for it.

Changing a definition's default reward does not automatically rewrite every existing classroom assignment. Edit each assignment when classroom delivery should change.

Updating an assignment refreshes its stored challenge-version marker to the definition's current version.

## Example: one challenge, three sections

Suppose `Robots.txt Trap` exists once in the catalog.

| Instance             | Opens        | Attempts  | Reward                |
| -------------------- | ------------ | --------- | --------------------- |
| CSC 1100 Section 001 | September 8  | Unlimited | 25 bits, 15 XP        |
| CSC 1100 Section 002 | September 10 | 3         | 30 bits, classroom XP |
| Security Workshop    | October 2    | 1         | No reward             |

The instructions and validator come from the same definition. Each class receives independent progress records and assignment settings.

## Removing an assignment

If no student progress exists, removing an assignment deletes only the assignment. The catalog definition remains available for other classrooms.

If progress exists, AWS Student Hub archives the assignment instead of deleting it. This preserves submissions, completion history, and reward references.

## Deleting a catalog definition

Curated definitions cannot be deleted from the dashboard.

A custom definition can be deleted only when:

- It is not published.
- It has no assignments in any classroom.

Archive it first, remove every unused classroom assignment, then delete it. Assignments with progress archive rather than delete, so a custom definition with historical classroom activity should normally remain archived.

## Avoid these mistakes

- Do not create one duplicate definition per section.
- Do not place section dates or reward values in reusable instructions.
- Do not archive the global definition when only one class should stop seeing it.
- Do not deactivate an entire instance when only one challenge should close.
- Do not recreate a curated challenge as custom because it is missing from the catalog; repair the environment's curated seed instead.
