import { expect, test } from '@playwright/test';

import { captureElement, requireCaptureCredential, signIn } from './helpers';

test('capture the challenge catalog and classroom workspace', async ({ page }) => {
  const identifier = requireCaptureCredential('DOCS_ADMIN_IDENTIFIER');
  const password = requireCaptureCredential('DOCS_ADMIN_PASSWORD');

  await signIn(page, identifier, password);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();

  await page.locator('[data-tab="rewards"]').click();
  const instanceManager = page.locator('.instance-manager-shell');
  await expect(instanceManager).toBeVisible();

  const adminMasks = [
    page.locator('.instance-key-preview'),
    page.locator('.instance-info-card strong'),
    page.locator('.instance-member-identity small'),
  ];

  await captureElement(instanceManager, 'instance-overview.png', adminMasks);

  const workspaceTabs = page.getByRole('navigation', { name: 'Instance management' });
  await workspaceTabs.getByRole('button', { name: 'challenges', exact: true }).click();
  await captureElement(page.locator('.instance-workspace'), 'instance-challenges.png', adminMasks);

  await workspaceTabs.getByRole('button', { name: 'students', exact: true }).click();
  await captureElement(page.locator('.instance-workspace'), 'instance-students.png', adminMasks);

  await page.locator('[data-tab="challenges"]').click();
  await captureElement(page.locator('.challenge-catalog-layout'), 'challenge-catalog.png');
});
