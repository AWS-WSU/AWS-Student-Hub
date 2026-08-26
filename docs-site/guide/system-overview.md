# System overview

This guide is for instructors and operators who have the AWS Student Hub `admin` or `superuser` role. It explains the system in operational terms without requiring knowledge of MongoDB, Express, or the frontend implementation.

## The five records that matter

<div class="doc-model">
  <div><strong>Instance</strong><span>The AWS Student Hub connection to one Prizeversity classroom.</span></div>
  <div><strong>Membership</strong><span>One verified student identity connected to one instance roster.</span></div>
  <div><strong>Definition</strong><span>A reusable challenge in the global catalog.</span></div>
  <div><strong>Assignment</strong><span>A definition configured for one instance.</span></div>
  <div><strong>Progress</strong><span>One student's work for one assignment.</span></div>
</div>

### Prizeversity instance

An instance represents exactly one Prizeversity classroom. It stores the classroom ID, a server-side API key, the expected API scopes, connection status, and a cached roster count.

If an instructor runs two sections of the same course, create two instances. Do not reuse one instance across multiple Prizeversity classrooms.

The instructor who creates an instance owns it. Other admins and superusers can still use the shared
challenge catalog, but cannot view or operate that instance or its classroom records.

### Student membership

A student verifies one Prizeversity identity, then connects each configured classroom they have joined. One student may therefore have several active memberships. Each membership is independently revalidated against its classroom roster and controls that classroom's challenge visibility and rewards.

### Catalog definition

A catalog definition describes the reusable challenge: title, instructions, difficulty, validation behavior, and default reward settings. Definitions are either:

- **Curated:** maintained in source control because the experience requires application code.
- **Custom:** authored by an admin through the dashboard using supported general-purpose validators.

Publishing a definition only makes it available for assignment. It does **not** expose the challenge to students.

### Classroom assignment

An assignment connects one catalog definition to one Prizeversity instance. The assignment owns the settings that may vary by class:

- Draft, published, or archived state
- Opening and closing dates
- Maximum attempts
- Bits and XP
- Reward multiplier behavior

The same definition can be assigned to many instances. Each assignment is independent.

### Student progress

Progress belongs to a student and an assignment, not merely to a student and a catalog definition. A student can therefore complete the same catalog challenge independently in two different classrooms without mixing attempts or rewards.

## How visibility is decided

A student can see a challenge only when every condition below is true:

1. The student has verified a Prizeversity identity.
2. The student has an active roster membership for the instance.
3. The catalog definition is published.
4. That definition has an assignment for one of the student's connected instances.
5. The assignment is published.
6. The current time is inside the assignment's opening and closing window.

If any condition fails, the challenge is omitted from that student's challenge list.

## What instructors manage

The admin dashboard separates global authoring from classroom delivery:

| Area                  | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| Challenge Catalog     | Create and maintain reusable definitions.                          |
| Reward Integrations   | Configure Prizeversity instances and their classroom assignments.  |
| Instance > Challenges | Add catalog entries and configure classroom-specific delivery.     |
| Instance > Students   | Inspect the Prizeversity roster, balance, XP, and AWS link status. |
| Manual Review         | Approve or reject submissions that require instructor judgment.    |

## Access boundary

Challenge and instance administration requires `admin` or `superuser`. A superuser satisfies every admin check.

See [Roles and permissions](./roles-and-permissions) for the full site-wide capability matrix, including moderation, events, user promotion, challenges, and instance management.

There is no separate administrator login. An instructor registers and signs in through the normal AWS Student Hub account flow, then opens **Admin Dashboard** after an authorized operator assigns the required role.

Only a superuser can assign `admin` or `superuser` roles from **User Management**. The first superuser for an environment is bootstrapped by an operator after that person has registered:

```bash
cd backend
MONGODB_URI='<target-mongodb-uri>' bun run create-superuser -- instructor@example.edu
```

Run that command against the intended environment. Instructors should not receive database credentials merely to promote accounts.

Challenge definitions are organization-wide so instructors can reuse the same catalog. Instances,
assignments, rosters, progress, submissions, reviews, and reward operations are scoped to the
instructor who created the instance. Superusers follow the same classroom ownership boundary.

## Where data lives

AWS Student Hub stores catalog definitions, assignments, attempts, submissions, completion state, and reward-delivery records. Prizeversity remains the source of truth for classroom membership, bits, XP, and related reward state.

AWS Student Hub never returns a stored Prizeversity API key to the browser. The admin UI receives only a shortened preview.

## Next step

Use the [semester runbook](./semester-runbook) when preparing a real class. It presents the required operations in deployment order.
