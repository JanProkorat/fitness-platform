/**
 * #1094 — Client detail page, Overview tab. Path is under trainer/ so
 * playwright.config.ts's role-subfolder testMatch collects it (see
 * clients.spec.ts's own header comment — a spec at the e2e/ root runs on
 * no project at all).
 *
 * Verifies the wireframe's layout contract: the six not-yet-built tabs and
 * all four header buttons render disabled with the shell's coming-soon
 * treatment, every card the backend cannot supply a value for shows the
 * literal TBD placeholder, the Messages trend widget renders its four
 * W1-W4 groups, and — the AC this issue's backend slice exists for — the
 * detail page's status pill text equals the same client's status badge on
 * the clients list, asserted by comparison rather than a hardcoded word.
 */
import { trainerTest as test, expect } from '../fixtures/auth';

const DISABLED_TAB_NAMES = ['Development', 'Nutrition', 'Workouts', 'Storage', 'Payment', 'Automations'];
const DISABLED_BUTTON_NAMES = ['Chat', 'Tasks', 'Notes', 'Info'];

test.describe('client detail page — overview tab', () => {
  test('renders the layout contract: coming-soon tabs/buttons, TBD cards, W1-W4 trend labels, and a status pill matching the clients list', async ({
    page,
  }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const row = page.getByRole('row', { name: /QA Client/ });
    await expect(row).toBeVisible();

    // Capture the list badge's text BEFORE navigating away — this is the
    // value the detail page's pill must equal.
    const listStatusText = (await row.locator('[data-slot="badge"]').first().innerText()).trim();
    expect(listStatusText.length).toBeGreaterThan(0);

    await row.getByRole('link', { name: /QA Client/ }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /QA Client/ })).toBeVisible();

    // The status pill comparison — never a hardcoded status word (AC).
    const detailStatusBadge = page.locator('[data-slot="badge"]').first();
    await expect(detailStatusBadge).toHaveText(listStatusText);

    // Overview is the only enabled tab; the other six are disabled with
    // the coming-soon treatment.
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeEnabled();
    for (const tabName of DISABLED_TAB_NAMES) {
      const tab = page.getByRole('tab', { name: tabName });
      await expect(tab).toBeVisible();
      await expect(tab).toBeDisabled();
    }

    // All four header action buttons render disabled.
    for (const buttonName of DISABLED_BUTTON_NAMES) {
      await expect(page.getByRole('button', { name: new RegExp(buttonName) })).toBeDisabled();
    }

    // TBD cards — average rating, payments, the check-in trend, and the
    // Tasks button all render the literal TBD placeholder unconditionally,
    // regardless of seed data (nothing hidden, nothing invented).
    const tbdCount = await page.getByText('TBD', { exact: true }).count();
    expect(tbdCount).toBeGreaterThanOrEqual(4);

    // Messages trend renders its four W1-W4 groups, fed by the new
    // message-stats endpoint.
    for (const label of ['W1', 'W2', 'W3', 'W4']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });
});
