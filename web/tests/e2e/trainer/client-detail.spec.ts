/**
 * #1094 — Client detail page, Overview tab. Path is under trainer/ so
 * playwright.config.ts's role-subfolder testMatch collects it (see
 * clients.spec.ts's own header comment — a spec at the e2e/ root runs on
 * no project at all).
 *
 * Verifies the layout contract: the six not-yet-built tabs and the three
 * still-unbuilt header buttons render disabled with the shell's coming-soon
 * treatment, the rebuilt Overview shows its three stat tiles and four lower
 * cards (#1295), and — the AC this issue's backend slice exists for — the
 * detail page's status pill text equals the same client's status badge on
 * the clients list, asserted by comparison rather than a hardcoded word.
 *
 * Chat went live in #1095 — it is no longer in DISABLED_BUTTON_NAMES; its
 * own assertion below checks it navigates to `/inbox?client=<publicId>`.
 */
import { trainerTest as test, expect } from '../fixtures/auth';

const DISABLED_TAB_NAMES = ['Development', 'Nutrition', 'Workouts', 'Storage', 'Payment', 'Automations'];
const DISABLED_BUTTON_NAMES = ['Tasks', 'Notes', 'Info'];

test.describe('client detail page — overview tab', () => {
  test('renders the layout contract: coming-soon tabs/buttons, the rebuilt overview cards, and a status pill matching the clients list', async ({
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

    // The three still-unbuilt header action buttons render disabled.
    for (const buttonName of DISABLED_BUTTON_NAMES) {
      await expect(page.getByRole('button', { name: new RegExp(buttonName) })).toBeDisabled();
    }

    // Chat is live (#1095) — it's a link, not a disabled button, and it
    // carries this client's publicId as the inbox deep-link query param.
    const chatLink = page.getByRole('link', { name: 'Chat' });
    await expect(chatLink).toBeVisible();
    const chatHref = await chatLink.getAttribute('href');
    expect(chatHref).toMatch(/^\/inbox\?client=[0-9a-f-]{36}$/);

    // Stat row (#1295): meal compliance, PRs this month, client since.
    for (const label of ['Meal compliance', 'PRs this month', 'Client since']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // Lower cards: check-in trend + weight, recent activity + client profile.
    for (const name of ['Check-in trend', 'Weight', 'Recent activity', 'Client profile']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }

    // The retired placeholders are gone: no TBD stat cards, no messages
    // trend widget.
    await expect(page.getByText('Average rating', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Payments', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Messages trend' })).toHaveCount(0);
  });
});
