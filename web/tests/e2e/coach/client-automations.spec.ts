/**
 * Client detail -> Automations tab, as the QA trainer on Client 3. The tab falls back to the QA client
 * when Client 3 answers with no automation coverage. Every rule the spec creates has a unique name and
 * is removed again; no assertion counts rows, because other specs share the fixture.
 */
import { trainerTest as test, expect } from '../fixtures/auth';
import type { Locator, Page } from '@playwright/test';
import { ensureCheckInSetting } from '../fixtures/check-in-setting';

const CLIENT_IDS = ['77777777-7777-7777-aaaa-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'];
const WEEKDAY = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(day|sday|nesday|rsday|urday)?\b/;

/** Opens the Automations tab of the first client that grants coverage and returns that client's id. */
async function openClientTab(page: Page): Promise<string> {
  for (const clientId of CLIENT_IDS) {
    await page.goto(`/clients/${clientId}/automations`);
    const addRule = page.getByRole('button', { name: /^Add rule for/ });
    const noAccess = page.getByText(/doesn’t include automations/);
    await addRule.or(noAccess).first().waitFor();
    if (await addRule.isVisible()) {
      return clientId;
    }
  }
  throw new Error('No fixture client grants automation coverage to the QA trainer');
}

function rowOf(page: Page, name: string): Locator {
  return page.getByRole('row').filter({ hasText: name });
}

/** Today plus the given days as yyyy-MM-dd in the browser's local time. */
function isoDateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function createGlobalRule(page: Page, name: string) {
  await page.goto('/automations');
  await page.getByRole('button', { name: 'New rule' }).first().click();
  const drawer = page.getByRole('dialog');
  await drawer.getByLabel('Name', { exact: true }).fill(name);
  await drawer.getByRole('button', { name: 'Request measurements' }).click();
  await drawer.getByLabel('Every', { exact: true }).fill('2');
  await drawer.getByRole('button', { name: 'Save rule' }).click();
  await expect(drawer).toBeHidden();
  await expect(rowOf(page, name)).toBeVisible();
}

async function deleteGlobalRule(page: Page, name: string) {
  await page.goto('/automations');
  await page.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete rule' }).click();
  await expect(rowOf(page, name)).toHaveCount(0);
}

test.describe('client automations tab', () => {
  test('the tab is live, shows the linked check-in without a weekday and the 30-day summary', async ({
    page,
    baseURL,
  }) => {
    await ensureCheckInSetting(baseURL ?? 'http://localhost:5173');
    await openClientTab(page);
    await expect(page.getByRole('tab', { name: 'Automations' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: /^Sent to / })).toBeVisible();
    await expect(page.getByText('Last 30 days')).toBeVisible();

    const table = page.getByRole('table');
    const linked = page.getByRole('row').filter({ hasText: 'Weekly check-in' }).first();
    await expect(linked).toBeVisible();
    await expect(linked.getByText('Linked')).toBeVisible();
    await expect(linked.getByRole('switch')).toHaveCount(0);
    await expect(linked.getByRole('link', { name: 'Open' })).toBeVisible();
    expect(await table.innerText()).not.toMatch(WEEKDAY);
  });

  test('pause from the switch and from the drawer, customise and reset, add and delete a client-only rule', async ({
    page,
  }) => {
    const suffix = Date.now().toString(36);
    const globalName = `E2E client rule ${suffix}`;
    const clientOnlyName = `E2E only-client rule ${suffix}`;
    const note = `knee injury ${suffix}`;

    await createGlobalRule(page, globalName);
    try {
      await openClientTab(page);
      const row = rowOf(page, globalName);
      await expect(row).toBeVisible();
      await expect(row).toContainText('Default');
      await expect(row).toContainText('Every 2 weeks');

      // Pause and resume from the row switch: no dialog, no date.
      const toggle = page.getByRole('switch', { name: `Rule “${globalName}” active for this client` });
      await expect(toggle).toBeChecked();
      await toggle.click();
      await expect(toggle).not.toBeChecked();
      await expect(row).toContainText('Paused');
      await toggle.click();
      await expect(toggle).toBeChecked();
      await expect(row).toContainText('Default');

      // Pause with a date and a note from the drawer; a pause-only change must not make the row Custom.
      await page.getByRole('button', { name: globalName, exact: true }).click();
      const drawer = page.getByRole('dialog');
      await expect(drawer.getByText(`Customise · ${globalName}`)).toBeVisible();
      await drawer.getByRole('switch', { name: 'Paused' }).click();
      await drawer.getByLabel('Paused until').fill(isoDateInDays(10));
      await drawer.getByLabel('Note').fill(note);
      await drawer.getByRole('button', { name: 'Save rule' }).click();
      await expect(drawer).toBeHidden();
      await expect(row).toContainText('Paused until');
      await expect(row).toContainText(note);
      await expect(row).not.toContainText('Custom for');
      await expect(row.getByRole('button', { name: 'Reset' })).toHaveCount(0);

      // Resume from the switch; the date and note go with it.
      await toggle.click();
      await expect(toggle).toBeChecked();
      await expect(row).not.toContainText(note);

      // Customise: another interval makes the row Custom and offers Reset.
      await page.getByRole('button', { name: globalName, exact: true }).click();
      const customise = page.getByRole('dialog');
      await customise.getByLabel('Every', { exact: true }).fill('3');
      await customise.getByRole('button', { name: 'Save rule' }).click();
      await expect(customise).toBeHidden();
      await expect(row).toContainText('Custom for');
      await expect(row).toContainText('Every 3 weeks');
      await expect(row).toContainText('Changed from');
      await row.getByRole('button', { name: 'Reset' }).click();
      await expect(row).toContainText('Default');
      await expect(row).toContainText('Every 2 weeks');

      // A client-only rule: add, switch off and on, delete.
      await page.getByRole('button', { name: /^Add rule for/ }).click();
      const addDrawer = page.getByRole('dialog');
      await addDrawer.getByLabel('Name', { exact: true }).fill(clientOnlyName);
      await addDrawer.getByRole('button', { name: 'Request measurements' }).click();
      await addDrawer.getByLabel('Every', { exact: true }).fill('2');
      await expect(addDrawer.getByRole('switch', { name: 'Paused' })).toHaveCount(0);
      await addDrawer.getByRole('button', { name: 'Save rule' }).click();
      await expect(addDrawer).toBeHidden();
      const onlyRow = rowOf(page, clientOnlyName);
      await expect(onlyRow).toBeVisible();
      await expect(onlyRow).toContainText(/Only /);

      const onlyToggle = page.getByRole('switch', { name: `Enable rule “${clientOnlyName}”` });
      await expect(onlyToggle).toBeChecked();
      await onlyToggle.click();
      await expect(onlyToggle).not.toBeChecked();
      await onlyToggle.click();
      await expect(onlyToggle).toBeChecked();

      await page.getByRole('button', { name: `Actions for ${clientOnlyName}` }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete rule' }).click();
      await expect(onlyRow).toHaveCount(0);

      expect(await page.getByRole('table').innerText()).not.toMatch(WEEKDAY);
    } finally {
      await deleteGlobalRule(page, globalName);
    }
  });
});
