import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Phased allowlist for the no-literal-string rule below (#580). These files
// pre-date the rule and already surfaced violations at the time #580 landed
// — many are unit-abbreviation false positives ("g", "kcal", "min" appended
// directly after a JSX expression container) rather than real hardcoded
// copy, but some are genuine leftover literals. Target: shrink this list to
// zero as each file gets its own i18n cleanup pass (do not add new entries
// for new code — new files must pass the rule outright).
const JSX_LITERAL_ALLOWLIST = [
  'src/ErrorBoundary.tsx',
  'src/components/NewClientDialog.tsx',
  'src/components/TiptapEditor.tsx',
  'src/components/TrainerProfileFields.tsx',
  'src/components/clients/ActiveNutritionPlanCard.tsx',
  'src/components/clients/IdentityStrip.tsx',
  'src/components/clients/ProgressSnapshot.tsx',
  'src/components/data/MacroBadges.tsx',
  'src/components/layout/AppShell.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/nutrition/AnamnesisSectionPanel.tsx',
  'src/components/nutrition/FoodRow.tsx',
  'src/components/nutrition/FoodSearch.tsx',
  'src/components/nutrition/GoalsMacroPanel.tsx',
  'src/components/nutrition/MacroSidebar.tsx',
  'src/components/nutrition/MealBlock.tsx',
  'src/components/nutrition/RecipeDetailDialog.tsx',
  'src/components/nutrition/RecipeDialog.tsx',
  'src/components/nutrition/RecipeRow.tsx',
  'src/components/nutrition/RecipeSearch.tsx',
  'src/components/training/ExerciseCardHeader.tsx',
  'src/components/training/SessionFormatBar.tsx',
  'src/components/training/TrainingSidebar.tsx',
  'src/components/training/WorkoutDialog.tsx',
  'src/pages/DashboardPage.tsx',
  'src/pages/DownloadAppPage.tsx',
  'src/pages/FoodsPage.tsx',
  'src/pages/LoginPage.tsx',
  'src/pages/MessagesPage.tsx',
  'src/pages/RecipesPage.tsx',
  'src/pages/RegisterPage.tsx',
  'src/pages/VerifyEmailPage.tsx',
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Guards against the class of i18n regression tracked in #555 and its
    // follow-ups (#577/#578/#579): a raw JSX string literal silently ships
    // hardcoded Czech with no CI signal. Implemented as a custom
    // `no-restricted-syntax` selector (a core ESLint rule) rather than
    // pulling in eslint-plugin-i18next or eslint-plugin-react — neither is
    // an existing dependency, and adding one wasn't discussed (#580 notes:
    // "prefer eslint-plugin-i18next IF already installed").
    //
    // Scope: src/**/*.tsx only (excludes generated.ts, which is
    // write-locked anyway and would trip this rule on doc-comment-derived
    // JSX it doesn't actually contain). Test/e2e specs live outside src/
    // (web/tests/e2e/**) and are untouched by this glob.
    files: ['src/**/*.tsx'],
    ignores: ['src/api/generated.ts', ...JSX_LITERAL_ALLOWLIST],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // Matches JSX text content containing any Unicode letter (so cs/de
          // diacritics are caught, not just plain ASCII) — i.e. it does NOT
          // fire on whitespace-only text, punctuation-only text ("·", "→"),
          // or purely numeric content, which the #580 notes call out as
          // intentional exemptions.
          selector: 'JSXText[value=/\\p{L}/u]',
          message:
            'Raw JSX text literal — route user-facing copy through t(...) and add the key to src/i18n/locales/{cs,en,de}.json (#580).',
        },
        {
          // Placeholder text is one of the most common i18n-regression
          // vectors (#555 follow-ups) and, unlike most other JSX
          // attributes (className, type, autoComplete, SVG path data...),
          // is essentially always user-facing copy — safe to check narrowly.
          selector: "JSXAttribute[name.name='placeholder'] > Literal[value=/\\p{L}/u]",
          message:
            'Raw placeholder string literal — route through t(...) (#580).',
        },
      ],
    },
  },
])
