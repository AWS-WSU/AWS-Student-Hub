import { test } from '@playwright/test';

import { captureElement, requireCaptureCredential, signIn } from './helpers';

test('capture the student Prizeversity account panel', async ({ page }) => {
  test.skip(
    !process.env.DOCS_STUDENT_IDENTIFIER || !process.env.DOCS_STUDENT_PASSWORD,
    'Set the optional student fixture credentials to capture account linking.'
  );

  const identifier = requireCaptureCredential('DOCS_STUDENT_IDENTIFIER');
  const password = requireCaptureCredential('DOCS_STUDENT_PASSWORD');

  await signIn(page, identifier, password);
  await page.goto('/account#prizeversity-rewards');

  const linkingPanel = page.locator('#prizeversity-rewards');
  const masks = [
    page.locator('#prizeversity-identifier'),
    page.locator('.prizeversity-linked-panel strong'),
    page.locator('.prizeversity-code-row input'),
  ];

  await captureElement(linkingPanel, 'student-account-linking.png', masks);
});
