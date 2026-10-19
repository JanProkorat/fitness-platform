import type { ConfigContext } from 'expo/config';

// Plain-data module only: this file is evaluated by Node outside the app, so it must not
// (transitively) import react-native or any Expo runtime module.
// Expo's config loader resolves local TS imports only with an explicit `.ts` extension, which
// tsc rejects without `allowImportingTsExtensions`; the types still resolve via the expect-error.
// Node loads the imported file itself, so this needs native type stripping (Node >= 22.18).
// @ts-expect-error TS5097: explicit extension required by Expo's config evaluator (SDK 57).
import { darkColors, lightColors } from './src/theme/colors.ts';

type PluginEntry = string | [string, Record<string, unknown>];

const SPLASH_PLUGIN = 'expo-splash-screen';

/** Fills the splash and adaptive-icon background colours from the theme tokens. */
export default ({ config }: ConfigContext) => ({
  ...config,
  android: {
    ...config.android,
    adaptiveIcon: {
      ...config.android?.adaptiveIcon,
      backgroundColor: lightColors.launchMarkDeep,
    },
  },
  plugins: (config.plugins as PluginEntry[] | undefined)?.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== SPLASH_PLUGIN) {
      return plugin;
    }
    return [
      SPLASH_PLUGIN,
      {
        ...plugin[1],
        backgroundColor: lightColors.ground,
        dark: { backgroundColor: darkColors.ground },
      },
    ];
  }),
});
