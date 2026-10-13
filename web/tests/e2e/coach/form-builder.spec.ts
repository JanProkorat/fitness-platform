/**
 * #1342 — the form builder: build an onboarding form from the palette, edit, duplicate,
 * delete and drag-reorder questions, save, reload and see it persisted. A second case
 * covers a check-in form, which has no "default for new clients" switch.
 * Waits are on UI state only (status text, counts, values), never fixed timeouts.
 */
import { trainerTest, expect } from '../fixtures/auth';
import type { Locator, Page } from '@playwright/test';

trainerTest.use({ viewport: { width: 1440, height: 1100 } });

async function createForm(page: Page, name: string, typeLabel: 'Onboarding' | 'Check-in') {
  await page.goto('/forms');
  await page.getByRole('button', { name: 'New form' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByRole('radio', { name: new RegExp(typeLabel) }).click();
  await dialog.getByRole('button', { name: 'Create form' }).click();
  await expect(page).toHaveURL(/\/forms\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel('Form name')).toHaveValue(name);
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
}

async function deleteForm(page: Page, name: string) {
  await page.goto('/forms');
  await page.getByRole('searchbox', { name: 'Search forms…' }).fill(name);
  // The debounced search lands in the URL, then the list refetches to the one matching row.
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(1);
  await page.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0);
}

/** Presses on the centre of `from`, moves in small steps (dnd-kit's pointer sensor needs them) and releases over `to`. */
async function dragTo(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded();
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) {
    throw new Error('drag source or target is not on screen');
  }
  const startX = start.x + start.width / 2;
  const startY = start.y + start.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 8, startY + (end.y < start.y ? -8 : 8), { steps: 4 });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 });
  await page.mouse.up();
}

async function expectTitles(page: Page, titles: string[]) {
  await expect(page.getByTestId('question-card')).toHaveCount(titles.length);
  for (const [index, title] of titles.entries()) {
    await expect(page.getByLabel(`Question ${index + 1} title`)).toHaveValue(title);
  }
}

trainerTest.describe('form builder', () => {
  trainerTest('builds, edits, reorders and saves an onboarding form', async ({ page }) => {
    const name = `E2E builder ${Date.now().toString(36)}`;
    await createForm(page, name, 'Onboarding');

    try {
      await expect(page.getByText('No questions yet')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

      // Onboarding forms can be made the default for new clients (not toggled here: it is a shared setting).
      await page.getByRole('button', { name: 'Settings' }).click();
      await expect(page.getByRole('dialog', { name: 'Form settings' }).getByLabel('Default for new clients')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      // Multiple choice via the palette: title, two default choices, a third, Allow "Other".
      await page.getByRole('button', { name: 'Add Multiple choice' }).click();
      await expect(page.getByTestId('question-card')).toHaveCount(1);
      await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');
      await page.getByLabel('Question 1 title').fill('Primary goals');
      await page.getByLabel('Choice 1', { exact: true }).fill('Weight loss');
      await page.getByRole('button', { name: 'Add choice' }).click();
      await page.getByLabel('Choice 3', { exact: true }).fill('Strength');
      await page.getByRole('switch', { name: 'Allow “Other”' }).click();

      // Number with a range and a unit.
      await page.getByRole('button', { name: 'Add Number' }).click();
      await page.getByLabel('Question 2 title').fill('Training days');
      await page.getByLabel('Min', { exact: true }).fill('0');
      await page.getByLabel('Max', { exact: true }).fill('7');
      await page.getByLabel('Unit', { exact: true }).fill('days');

      // Text, then duplicate the number question, retitle the copy and delete it again.
      await page.getByRole('button', { name: 'Add Text' }).click();
      await page.getByLabel('Question 3 title').fill('Injuries');
      await page.getByRole('button', { name: 'Duplicate question 2' }).click();
      await expectTitles(page, ['Primary goals', 'Training days', 'Training days', 'Injuries']);
      await page.getByLabel('Question 3 title').fill('Copy to remove');
      await page.getByRole('button', { name: 'Delete question 3' }).click();
      await expectTitles(page, ['Primary goals', 'Training days', 'Injuries']);
      await expect(page.getByTestId('question-count')).toHaveText('3 questions');

      // Reorder: select the last card so the layout is stable, then drag its handle onto the first card.
      await page.getByLabel('Question 3 title').click();
      await dragTo(page, page.getByRole('button', { name: 'Reorder question 3' }), page.getByTestId('question-card').first());
      await expectTitles(page, ['Injuries', 'Primary goals', 'Training days']);

      // Save and reload: order and contents persist.
      await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
      await page.reload();
      await expect(page.getByLabel('Form name')).toHaveValue(name);
      await expectTitles(page, ['Injuries', 'Primary goals', 'Training days']);

      await page.getByLabel('Question 2 title').click();
      await expect(page.getByLabel('Choice 1', { exact: true })).toHaveValue('Weight loss');
      await expect(page.getByLabel('Choice 2', { exact: true })).toHaveValue('Option 2');
      await expect(page.getByLabel('Choice 3', { exact: true })).toHaveValue('Strength');
      await expect(page.getByRole('switch', { name: 'Allow “Other”' })).toBeChecked();
      await page.getByLabel('Question 3 title').click();
      await expect(page.getByLabel('Min', { exact: true })).toHaveValue('0');
      await expect(page.getByLabel('Max', { exact: true })).toHaveValue('7');
      await expect(page.getByLabel('Unit', { exact: true })).toHaveValue('days');

      // Drag a palette tile into the form: it lands above the card it is dropped on.
      await dragTo(page, page.getByRole('button', { name: 'Add Star rating' }), page.getByTestId('question-card').first());
      await expect(page.getByTestId('question-card')).toHaveCount(4);
      await expect(page.getByTestId('question-card').first()).toHaveAttribute('data-kind', 'star_rating');
      await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');

      // Leaving with unsaved changes asks first; leaving anyway goes back to the list.
      await page.getByRole('button', { name: 'Back to forms' }).click();
      await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
      await page.getByRole('button', { name: 'Leave', exact: true }).click();
      await expect(page).toHaveURL(/\/forms$/);
    } finally {
      await deleteForm(page, name);
    }
  });

  trainerTest('check-in form has no default switch and saves', async ({ page }) => {
    const name = `E2E check-in builder ${Date.now().toString(36)}`;
    await createForm(page, name, 'Check-in');

    try {
      // The check-in board lists the rating types first.
      await expect(page.getByTestId('palette-tile').first()).toHaveAttribute('data-kind', 'smiley_rating');
      await expect(page.getByText(/Weekly check-in/)).toBeVisible();
      await expect(page.getByText(/Sunday|Sonntag|neděl/i)).toHaveCount(0);

      await page.getByRole('button', { name: 'Settings' }).click();
      const sheet = page.getByRole('dialog', { name: 'Form settings' });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByLabel('Default for new clients')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);

      await page.getByRole('button', { name: 'Add Smiley rating' }).click();
      await page.getByLabel('Question 1 title').fill('Energy this week');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-status')).toHaveText('Saved');

      await page.reload();
      await expectTitles(page, ['Energy this week']);
      await expect(page.getByTestId('question-card').first()).toHaveAttribute('data-kind', 'smiley_rating');
      await expect(page.getByLabel('Lowest face label')).toHaveValue('Very low');
    } finally {
      await deleteForm(page, name);
    }
  });
});
