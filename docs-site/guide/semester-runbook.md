# Semester runbook

This runbook takes a new Prizeversity classroom from initial setup to its first rewarded challenge completion.

## Before you begin

You need:

- An active AWS Student Hub account with the `admin` or `superuser` role
- A Prizeversity classroom created for the exact section you are operating
- The classroom ID
- A Prizeversity integration API key scoped to that classroom
- The scopes `users:read`, `users:match`, and `reward:grant`
- Students entered in Prizeversity with valid email addresses

::: danger Treat the API key as a password
Enter it only in the AWS Student Hub admin dashboard. Do not send it to students, paste it into client-side code, include it in screenshots, or commit it to the repository.
:::

## 1. Create the classroom instance

Open **Admin Dashboard > Reward Integrations**, then select **New instance**.

Enter an internal name that distinguishes the semester and section, such as `CSC 1100 - Fall 2026 - Section 002`. Enter the Prizeversity classroom ID, API key, and base URL. Keep the default scopes unless the integration contract has intentionally changed.

Creating the instance performs a live classroom roster request. Creation succeeds only when AWS Student Hub can authenticate to Prizeversity and read that classroom.

After creation, confirm:

- The instance is marked active and verified.
- The returned classroom name matches the intended section.
- The student count is plausible.
- The classroom ID has no quotes or trailing characters.

## 2. Confirm the connection

Select the instance and use **Check connection**. This performs a fresh authenticated roster request, then updates the verification time, status, classroom label, and user count.

It does not issue rewards, modify students, or test a challenge submission.

If verification fails, stop here. Do not publish assignments until the classroom ID, API key, base URL, and scopes are correct.

## 3. Prepare the challenge catalog

Open **Admin Dashboard > Challenges**. The page heading identifies this area as the **Challenge catalog**.

For an existing curated challenge, verify that its definition is published. For a teacher-authored challenge, create a custom `static_secret` or `manual_review` definition, test its instructions and validation, then publish it.

::: info Definitions are global
Do not put section-specific dates, student names, or reward values into reusable challenge instructions. Configure section-specific behavior on the assignment instead.
:::

If an expected curated challenge is missing entirely, that is a deployment or seeding issue for a developer. Instructors should not recreate a curated challenge as a custom record.

## 4. Assign challenges to the instance

Return to **Reward Integrations**, select the classroom, open **Challenges**, and choose **Add from catalog**.

Configure each assignment:

| Setting  | Recommendation                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Status   | Start as `draft` while verifying configuration.                                                            |
| Opens    | Set when students should first see the challenge. Leave blank for immediate availability after publishing. |
| Closes   | Set the final availability time. Leave blank for no automatic close.                                       |
| Attempts | Leave unlimited unless guessing should have a defined consequence.                                         |
| Bits     | Use the classroom's reward scale rather than the catalog default blindly.                                  |
| XP mode  | Use `custom` for a fixed amount, `classroom` for Prizeversity's classroom behavior, or `none`.             |

The same catalog definition may be assigned to another section with different dates, attempts, and rewards.

## 5. Perform an instructor acceptance check

Before publishing to the full class:

1. Confirm the instance still passes **Check connection**.
2. Confirm the assignment points to the intended catalog definition.
3. Review opening and closing times, including timezone assumptions.
4. Review reward values and XP mode.
5. Use a non-production student fixture or designated test student to link into the instance.
6. Confirm the challenge appears only after the assignment is published and in its active window.
7. Submit a known correct response and verify the resulting bits and XP in Prizeversity.

Do not repeatedly test reward delivery with a real student. Reward emission is intentionally idempotent for a student, classroom, and challenge key.

## 6. Publish and onboard students

Publish the assignment. Students then link from **Account Settings > Prizeversity Rewards**.

Tell students which classroom to select if more than one active instance exists. They can identify themselves with the email, full name, short ID, or user ID stored in Prizeversity. The actual link is not established until they enter the one-time code sent to the Prizeversity email address.

Use the instance **Students** tab to verify which roster members have linked AWS Student Hub accounts.

## 7. Operate the challenge

During the active window:

- Watch assignment completion and pending-review counts.
- Review manual submissions from the selected classroom rather than from an unfiltered global list.
- Investigate `reward_failed` results promptly.
- Correct the assignment rather than cloning the catalog definition when only dates, attempts, or rewards are wrong.

## 8. Close the section

At the end of the run, archive assignments rather than deleting records with student activity. Archival removes the challenge from student visibility while preserving progress, submissions, and reward history.

Deactivate the instance only when the classroom should no longer support account linking, roster reads, challenge visibility, or reward delivery. Deactivation does not erase historical data.

## Semester rollover

For a new semester or section:

1. Create a new Prizeversity classroom.
2. Create a new AWS Student Hub instance with that classroom's API key.
3. Reuse catalog definitions by assigning them to the new instance.
4. Configure new dates, limits, and rewards.
5. Require students to join the new Prizeversity classroom and add that classroom in AWS Student Hub Account Settings. Existing verified identities do not replace or disconnect prior classes.

Do not rename an old instance and replace its classroom credentials merely to reuse the UI. A new instance preserves clean classroom and reward history.
