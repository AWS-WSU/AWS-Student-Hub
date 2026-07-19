---
layout: home

hero:
  name: Challenge Operations
  text: One system, clearly explained.
  tagline: Run Prizeversity-backed classrooms, publish reusable challenges, review student work, and extend the platform without reverse-engineering the application.
  actions:
    - theme: brand
      text: Run a semester
      link: /guide/semester-runbook
    - theme: alt
      text: Understand the architecture
      link: /reference/architecture

features:
  - title: Teacher operations
    details: Configure classroom instances, link students, assign catalog challenges, and handle reviews and rewards.
    link: /guide/system-overview
  - title: Challenge authoring
    details: Choose between no-code custom challenges and source-controlled curated experiences.
    link: /authoring/choose-a-type
  - title: Engineering reference
    details: Follow the data model, HTTP contracts, security boundaries, reward flow, and deployment requirements.
    link: /reference/architecture
---

## The shortest useful explanation

AWS Student Hub separates **what a challenge is** from **where and how it runs**. A catalog definition contains reusable content and validation. A classroom assignment connects that definition to one Prizeversity instance and supplies classroom-specific dates, attempts, and rewards.

<div class="doc-model">
  <div><strong>Prizeversity instance</strong><span>One external classroom and its server-side API credentials.</span></div>
  <div><strong>Catalog definition</strong><span>Reusable challenge content, validation, and defaults.</span></div>
  <div><strong>Classroom assignment</strong><span>Availability, attempts, schedule, bits, and XP for one class.</span></div>
  <div><strong>Student progress</strong><span>Attempts, submissions, completion, review, and reward delivery.</span></div>
</div>

<div class="signal">
  <strong>Start with the semester runbook.</strong>
  It is the operational path from a new Prizeversity classroom to the first rewarded completion.
</div>
