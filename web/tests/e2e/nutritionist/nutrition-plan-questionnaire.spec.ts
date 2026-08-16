/**
 * #698 — Nutrition Plan detail: linked questionnaire answers in a dedicated
 * "Dotazník" page tab (management actions stay in the sidebar). Mirror of #697.
 *
 * Fixture (QaSeedRunner #720): the QA nutritionist owns "QA Nutrition Intake
 * Questionnaire" and the QA client has a Submitted response linked to the
 * nutrition plan dddddddd-eeee-ffff-0000-111111111111. Runs under the
 * `nutritionist` project, authenticated via the `nutritionistTest` fixture
 * in ../fixtures/auth.ts (#897 — mints a fresh per-attempt refresh token
 * instead of reusing the shared .auth/nutritionist.json token), because the
 * nutrition plan is nutritionist-owned and GetClientResponses filters by the
 * calling professional's id.
 */
import { nutritionistTest as test, expect } from '../fixtures/auth';

const CLIENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const NUTRITION_PLAN_ID = 'dddddddd-eeee-ffff-0000-111111111111';

test.describe('Nutrition Plan — questionnaire answers tab (#698)', () => {
  test('renders the Dotazník tab with the nutritionist-owned response; sidebar keeps actions, inline answers gone', async ({
    page,
  }) => {
    await page.goto(`/clients/${CLIENT_ID}/plans/${NUTRITION_PLAN_ID}`);
    await page.waitForLoadState('networkidle');

    // AC2 — a third page-level tab "Dotazník" exists next to the meal-plan + photos tabs.
    const tab = page.getByRole('button', { name: 'Dotazník', exact: true });
    await expect(tab).toBeVisible();

    // AC1 — the inline "Zobrazit odpovědi (N)" answers toggle is gone from the sidebar.
    await expect(page.getByText(/Zobrazit odpovědi/i)).toHaveCount(0);

    await tab.click();

    // AC3 — header shows the questionnaire title + submitted date.
    await expect(
      page.getByRole('heading', { name: 'QA Nutrition Intake Questionnaire' }).first(),
    ).toBeVisible();

    // AC3 — each answered question renders as label -> formatted value.
    const goal = page
      .getByRole('listitem')
      .filter({ hasText: 'What is your primary dietary goal?' });
    await expect(goal).toContainText('Lose body fat while preserving muscle mass');

    const calories = page
      .getByRole('listitem')
      .filter({ hasText: 'How many calories do you currently consume per day?' });
    await expect(calories).toContainText('2200');

    const meals = page
      .getByRole('listitem')
      .filter({ hasText: 'How many meals do you eat per day?' });
    await expect(meals).toContainText('3-4');

    const appetite = page
      .getByRole('listitem')
      .filter({ hasText: 'Rate your current appetite level' });
    await expect(appetite).toContainText('6');

    const avoid = page
      .getByRole('listitem')
      .filter({ hasText: 'Which foods do you need to avoid?' });
    await expect(avoid).toContainText('Gluten');
    await expect(avoid).toContainText('Dairy');

    const diary = page
      .getByRole('listitem')
      .filter({ hasText: 'Upload a recent food diary (optional)' });
    await expect(diary).toContainText('food-diary-week1.pdf');
  });
});
