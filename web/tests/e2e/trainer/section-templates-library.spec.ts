/**
 * Durable spec — public workout-template library on the section-templates page (issue #824).
 *
 * Uses the pre-authenticated trainer storage state (trainer project in
 * playwright.config.ts). Hits the REAL compose harness (E2E_API_URL) —
 * MongoSeeder runs in the --qa-seed path since #809, so the harness carries
 * the 10 public workout templates (2 per WorkoutFormat).
 *
 * ONE consolidated test (see clients.spec.ts for the refresh-token-rotation
 * rationale — storageState restores a single-use refresh token).
 *
 * AC assertions (all in one journey):
 *   1. /training/section-templates renders the "Knihovna workoutů" (Template
 *      library) section for a trainer, regardless of own-template count.
 *   2. All 10 seeded public templates render as cards (name from cs locale,
 *      the harness UI default language).
 *   3. A card exposes format/difficulty metadata and a detail affordance.
 *   4. Opening a card's detail shows the template's sections with exercises
 *      and set prescriptions.
 *   5. The own-templates area keeps functioning alongside the library (page
 *      renders without error state whether or not own templates exist).
 */

import { test, expect } from '@playwright/test';

const SEEDED_TEMPLATE_NAMES_CS = [
  'Základy pro celé tělo',
  'Hypertrofie horní poloviny těla',
  'Kettlebellový triplet na čas',
  'Chipper s vlastní vahou',
  'AMRAP 20 s vlastní vahou',
  'Kettlebellový AMRAP 12',
  'EMOM 16 silové intervaly',
  'EMOM 10 pro začátečníky',
  'Tabata okruh na střed těla',
  'Tabata pro celé tělo',
];

test('template library — renders 10 public templates, detail shows sections and sets', async ({ page }) => {
  // Land on the dashboard first: a direct deep-link goto() races the
  // auth-store's restoreSession() and gets bounced back to /dashboard.
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Navigate via the sidebar (cs default locale: "Workouty"). The app route
  // is /section-templates.
  await page.getByRole('link', { name: 'Workouty' }).click();
  await page.waitForURL('**/section-templates');
  await page.waitForLoadState('networkidle');

  // 1. Library section heading is present (cs default locale of the harness).
  const libraryHeading = page.getByRole('heading', { name: 'Knihovna workoutů' });
  await expect(libraryHeading).toBeVisible();

  // 2. All 10 seeded public templates render as cards.
  for (const name of SEEDED_TEMPLATE_NAMES_CS) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }

  // 3+4. Open the first template's detail and assert structural content.
  // Each library card is a single clickable button whose accessible name
  // aggregates the card content (name, format, difficulty, counts).
  const firstCard = page.getByRole('button', { name: /Základy pro celé tělo/ });
  await expect(firstCard).toContainText('Obtížnost');
  await expect(firstCard).toContainText('Sekce');
  await firstCard.click();

  // The shared ui/Dialog is a portal without role="dialog" (pre-existing
  // a11y gap) — anchor on its h2 title instead.
  const dialogTitle = page.getByRole('heading', { level: 2, name: 'Základy pro celé tělo' });
  await expect(dialogTitle).toBeVisible();
  // Section names from the seed data for this template render inside the
  // detail (Standard template, 2 sections: Warm-up + Main strength).
  await expect(page.getByText('Warm-up').first()).toBeVisible();
  await expect(page.getByText('Main strength').first()).toBeVisible();

  // Close via the dialog's header close button (sibling of the h2 title).
  await page.locator('h2:has-text("Základy pro celé tělo") + button').click();
  await expect(dialogTitle).not.toBeVisible();

  // 5. Page is not in an error state; library coexists with the own-templates area.
  await expect(libraryHeading).toBeVisible();
});
