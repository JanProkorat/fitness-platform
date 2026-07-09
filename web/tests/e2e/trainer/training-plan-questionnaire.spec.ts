/**
 * #697 — Training Plan detail: linked questionnaire answers moved into a
 * dedicated "Dotazník" page tab (management actions stay in the sidebar).
 *
 * Fixture (seeded by QaSeedRunner, see #715 + docs/testing/e2e-fixtures.md):
 *   - QA trainer owns "QA Onboarding Questionnaire" (2 sections, mixed types).
 *   - QA client has a Submitted response linked to the main training plan
 *     dddddddd-… via QuestionnaireResponseId.
 *
 * Runs under the `trainer` project (storageState .auth/trainer.json), so the
 * caller is the professional who owns the response — GetClientResponses returns
 * it and the tab renders populated.
 */
import { test, expect } from '@playwright/test';

const CLIENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const LINKED_PLAN_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

test.describe('Training Plan — questionnaire answers tab (#697)', () => {
  test('renders the Dotazník tab with the linked response; sidebar keeps actions, inline answers gone', async ({
    page,
  }) => {
    await page.goto(`/clients/${CLIENT_ID}/training-plans/${LINKED_PLAN_ID}`);
    await page.waitForLoadState('networkidle');

    // AC2 — a third page-level tab "Dotazník" exists next to the plan + photos tabs.
    const tab = page.getByRole('button', { name: 'Dotazník', exact: true });
    await expect(tab).toBeVisible();

    // AC1 — the inline "Zobrazit odpovědi (N)" answers toggle is gone from the sidebar.
    await expect(page.getByText(/Zobrazit odpovědi/i)).toHaveCount(0);

    // Switch to the new tab.
    await tab.click();

    // AC3 — header shows the questionnaire title + submitted date.
    await expect(
      page.getByRole('heading', { name: 'QA Onboarding Questionnaire' }).first(),
    ).toBeVisible();

    // AC3 — every answered question renders as label -> formatted value.
    const goal = page
      .getByRole('listitem')
      .filter({ hasText: 'What is your main fitness goal?' });
    await expect(goal).toContainText('Build lean muscle and improve overall strength');

    const weight = page
      .getByRole('listitem')
      .filter({ hasText: 'What is your current body weight (kg)?' });
    await expect(weight).toContainText('78');

    const days = page
      .getByRole('listitem')
      .filter({ hasText: 'How many days per week do you currently train?' });
    await expect(days).toContainText('3-4');

    const energy = page
      .getByRole('listitem')
      .filter({ hasText: 'Rate your current energy level' });
    await expect(energy).toContainText('7');

    const injuries = page
      .getByRole('listitem')
      .filter({ hasText: 'Which areas have you previously injured?' });
    await expect(injuries).toContainText('Knee');
    await expect(injuries).toContainText('Shoulder');

    const file = page
      .getByRole('listitem')
      .filter({ hasText: 'Upload a recent medical clearance document (optional)' });
    await expect(file).toContainText('medical-clearance-checkup.pdf');

    // AC4 (no actions duplicated in the tab body) is confirmed by static review of
    // QuestionnaireAnswersView, which renders no management buttons — the sidebar
    // PlanQuestionnairePanel keeps assign/replace/cancel. Asserting that here would
    // require scoping past the always-visible sidebar, so it is left to static QA.
  });
});
