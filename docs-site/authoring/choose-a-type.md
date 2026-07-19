# Choose a challenge type

Start by deciding whether the challenge can be represented by an existing validator or needs a purpose-built experience.

<div class="decision-grid">
  <div>
    <h3>Custom challenge</h3>
    <p>Created entirely in the admin dashboard. Use when generic instructions plus a secret answer or instructor review are sufficient.</p>
  </div>
  <div>
    <h3>Curated challenge</h3>
    <p>Implemented and reviewed in source control. Use when the challenge needs routes, assets, personalized state, external services, or custom interaction.</p>
  </div>
</div>

## Decision table

| Requirement                                                 | Recommended type                                  |
| ----------------------------------------------------------- | ------------------------------------------------- |
| Every student submits the same secret or flag               | Custom `static_secret`                            |
| Students submit prose, a URL, or evidence for an instructor | Custom `manual_review`                            |
| The site must expose a special route or interactive screen  | Curated                                           |
| Validation depends on per-user AWS data                     | Curated                                           |
| Validation needs a new algorithm or external system         | Curated                                           |
| The challenge needs custom client state or animations       | Curated                                           |
| Only dates, attempts, or rewards differ by class            | One existing definition with multiple assignments |

## Custom does not mean classroom-specific

A custom definition is still global and reusable. “Custom” means it was authored through the dashboard rather than maintained by source code.

Create the definition once, publish it to the catalog, then assign it to each classroom that should receive it.

## Static secret

Choose `static_secret` when correctness can be determined by comparing one submitted value to one expected value.

Suitable examples:

- A flag discovered in a lab
- A passphrase returned by an external exercise
- A hidden value found through web reconnaissance
- A final answer produced by an offline puzzle

The expected plaintext is transformed to a SHA-256 hash before storage. Case handling, whitespace trimming, and accepted prefixes are configurable.

Do not use a static secret for a high-value assessment where students can trivially share one answer. The validator intentionally does not make a shared answer unique per student.

## Manual review

Choose `manual_review` when an instructor must judge quality, process, or evidence.

Suitable examples:

- Architecture explanations
- Screenshots or external project links
- Incident reports
- Reflection responses
- Demonstrations that cannot be validated safely by a deterministic rule

Manual review creates an operational queue. Estimate instructor load before assigning it to a large class.

## Curated experience

Choose curated when the mechanic itself needs code. Current examples include personalized AWS secrets, the hidden Robots.txt route, and Ciphered Seal's route, calculator, personalized layout, and sequence validation.

A curated challenge still becomes a normal catalog definition and classroom assignment. Source code provides the special experience; the catalog and assignment system still controls visibility, attempts, progress, review, and rewards.

## When to create a new definition

Create a new definition when the learning objective, expected proof, validator, or student-facing experience changes materially.

Do not create a new definition merely because:

- A new semester starts
- Another instructor uses it
- Dates change
- Attempt limits change
- Reward values change
- A different Prizeversity classroom receives it

Those are assignment concerns.
