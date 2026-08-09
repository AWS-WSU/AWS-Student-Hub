# Roles and permissions

AWS Student Hub uses one normal sign-in flow and four ordered roles. There is no separate administrator account type or administrator login page.

```text
member < moderator < admin < superuser
```

A higher role inherits the capabilities of every role below it. Backend middleware reloads the user's current role and account status from MongoDB for protected requests, so changing a browser value does not grant access.

## Capability matrix

| Capability                                          | Member | Moderator | Admin | Superuser |
| --------------------------------------------------- | :----: | :-------: | :---: | :-------: |
| Manage own profile and preferences                  |  Yes   |    Yes    |  Yes  |    Yes    |
| Verify Prizeversity identity and connect classrooms |  Yes   |    Yes    |  Yes  |    Yes    |
| View, start, and submit assigned challenges         |  Yes   |    Yes    |  Yes  |    Yes    |
| View dashboard statistics and user details          |   No   |    Yes    |  Yes  |    Yes    |
| Ban or unban a lower-role account                   |   No   |    Yes    |  Yes  |    Yes    |
| Create, update, publish, or delete events           |   No   |    No     |  Yes  |    Yes    |
| Manage challenge catalog and manual reviews         |   No   |    No     |  Yes  |    Yes    |
| Manage Prizeversity instances and assignments       |   No   |    No     |  Yes  |    Yes    |
| Inspect and retry email queue operations            |   No   |    No     |  Yes  |    Yes    |
| Assign `member` or `moderator` to a lower-role user |   No   |    No     |  Yes  |    Yes    |
| Assign `admin` or `superuser`                       |   No   |    No     |  No   |    Yes    |

## Member

`member` is the default role for students and general site users. Members manage their own account, verify a Prizeversity identity, connect one or more configured classrooms, and participate in challenges assigned to those classrooms.

A member cannot open protected administration routes. Challenge access is still determined by active classroom membership and assignment state, not by role alone.

## Moderator

`moderator` is a limited user-safety role. Moderators can view dashboard statistics and user records, and can ban or unban users below their own role.

Moderators cannot manage events, challenges, Prizeversity instances, rewards, the email queue, or user roles. They also cannot act on another moderator, admin, or superuser because operators may manage only lower-role accounts.

## Admin

`admin` is the normal instructor and operations role. Admins inherit moderator access and can manage:

- Events and event notifications
- Challenge definitions, publishing, validation tests, progress, and manual reviews
- Prizeversity instances, rosters, classroom assignments, schedules, attempts, and rewards
- Email queue inspection and retry operations
- Lower-role user accounts and promotion between `member` and `moderator`

Admins currently have organization-wide access to every instance and challenge. The platform does not yet restrict an instructor to selected classrooms.

An admin cannot grant `admin` or `superuser`, cannot manage an equal- or higher-role account, and does not receive separate database or infrastructure credentials.

## Superuser

`superuser` is the highest application role. It passes every admin authorization check and is the only role allowed to grant `admin` or `superuser` to another eligible lower-role account.

Superuser does not mean AWS account root, MongoDB owner, Auth0 tenant owner, or deployment administrator. Those are separate infrastructure identities. A superuser should not receive production secrets solely because of the application role.

Equal-role protection still applies: one superuser cannot modify or delete another superuser through normal user-management routes.

## Provisioning roles

Every instructor first registers through the normal site. An existing superuser then assigns the appropriate role from **Admin Dashboard > User Management**.

The first superuser in an environment is bootstrapped by an operator after the account exists:

```bash
cd backend
MONGODB_URI='<target-mongodb-uri>' bun run create-superuser -- instructor@example.edu
```

Run the command against the intended environment. Do not give instructors the MongoDB URI merely so they can promote accounts.

## Choosing a role

Use `member` for students, `moderator` for people who only handle user safety, `admin` for trusted instructors running events or classrooms, and `superuser` for the small number of operators responsible for granting administrative access.

Grant the lowest role that satisfies the person's responsibilities. Review elevated roles at the end of each semester and remove access that is no longer required.
