/**
 * Durable spec — coach profile page tag boxes.
 *
 * Text typed into the specializations or languages box without pressing Enter
 * is turned into a tag by Save, counts as an unsaved change, and is validated
 * like a typed tag. The profile reads are stubbed so no fixture data is needed.
 */
import type { Page } from '@playwright/test';
import { trainerTest as test, expect } from '../fixtures/auth';

interface TrainerProfileBody {
  specializations: string;
  languages: string;
}

const SAVE_STATE = 'profile-save-state';
const SAVE_BUTTON = { name: 'Save changes', exact: true } as const;

async function stubProfile(page: Page, onSave: (body: TrainerProfileBody) => void) {
  await page.route(/\/users\/me$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      json: {
        userId: '00000000-0000-0000-1993-000000000001',
        email: 'coach.1993@example.test',
        firstName: 'Test',
        lastName: 'Coach',
        roles: ['Trainer'],
      },
    });
  });
  await page.route(/\/trainer\/profile$/, async (route) => {
    const method = route.request().method();
    if (method === 'PUT') {
      onSave(route.request().postDataJSON() as TrainerProfileBody);
      await route.fulfill({ status: 204 });
      return;
    }
    if (method !== 'GET') return route.fallback();
    await route.fulfill({
      json: {
        specializations: JSON.stringify(['Strength']),
        languages: JSON.stringify(['Czech']),
        certificates: '[]',
        collaborationType: 'both',
        showInSearch: true,
        acceptNewClients: true,
      },
    });
  });
}

async function openProfile(page: Page) {
  await page.goto('/profile');
  await expect(page.getByLabel('Specializations', { exact: true })).toBeVisible();
}

test.describe('coach profile tag boxes', () => {
  test('saves text typed into a tag box without Enter', async ({ page }) => {
    const saved: TrainerProfileBody[] = [];
    await stubProfile(page, (body) => saved.push(body));
    await openProfile(page);

    await page.getByLabel('Specializations', { exact: true }).fill('Mobility');
    await page.getByLabel('Languages', { exact: true }).fill('English');
    await page.getByRole('button', SAVE_BUTTON).click();

    await expect.poll(() => saved.length).toBe(1);
    expect(JSON.parse(saved[0].specializations)).toEqual(['Strength', 'Mobility']);
    expect(JSON.parse(saved[0].languages)).toEqual(['Czech', 'English']);
  });

  test('validates pending text and sends nothing when the list is too long', async ({ page }) => {
    const saved: TrainerProfileBody[] = [];
    await stubProfile(page, (body) => saved.push(body));
    await openProfile(page);

    // Languages are limited by the serialized length of the whole list, not per item.
    await page.getByLabel('Languages', { exact: true }).fill('x'.repeat(1100));
    await page.getByRole('button', SAVE_BUTTON).click();

    await expect(page.getByText('Too many entries — remove some.')).toBeVisible();
    expect(saved).toHaveLength(0);
    await expect(page.getByLabel('Languages', { exact: true })).toBeVisible();
  });

  test('a typed draft alone makes the form saveable', async ({ page }) => {
    await stubProfile(page, () => undefined);
    await openProfile(page);

    const save = page.getByRole('button', SAVE_BUTTON);
    await expect(save).toHaveAttribute('aria-disabled', 'true');

    await page.getByLabel('Specializations', { exact: true }).fill('Mobility');
    await expect(save).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId(SAVE_STATE)).toContainText('Unsaved changes');

    await page.getByLabel('Specializations', { exact: true }).fill('');
    await expect(save).toHaveAttribute('aria-disabled', 'true');
  });
});
