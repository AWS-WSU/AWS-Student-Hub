import { expect, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outputDirectory = fileURLToPath(new URL('../../public/screenshots/', import.meta.url));

const captureStyle = `
  [role="alert"],
  .toast-container,
  .Toastify,
  vite-error-overlay {
    display: none !important;
  }

  *, *::before, *::after {
    animation: none !important;
    caret-color: transparent !important;
    transition: none !important;
  }
`;

export const requireCaptureCredential = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for documentation screenshot capture.`);
  }
  return value;
};

export const signIn = async (page: Page, identifier: string, password: string): Promise<void> => {
  await page.goto('/auth');
  await page.getByPlaceholder('Email or Username').fill(identifier);
  await page.getByPlaceholder('Password').fill(password);

  const policyCheckbox = page.locator('input[name="acceptedPolicies"]');
  if (await policyCheckbox.isVisible()) {
    await policyCheckbox.check();
  }

  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL((url) => url.pathname !== '/auth');

  if (new URL(page.url()).pathname === '/setup') {
    throw new Error('The documentation fixture account must complete onboarding before capture.');
  }
};

export const captureElement = async (
  locator: Locator,
  filename: string,
  masks: Locator[] = []
): Promise<void> => {
  await mkdir(outputDirectory, { recursive: true });
  await expect(locator).toBeVisible();
  await locator.screenshot({
    path: `${outputDirectory}/${filename}`,
    animations: 'disabled',
    caret: 'hide',
    mask: masks,
    maskColor: '#d7ddd8',
    scale: 'css',
    style: captureStyle,
  });
};
