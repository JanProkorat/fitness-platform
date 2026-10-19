import type { ConfigContext, ExpoConfig } from 'expo/config';

// Plain-data module only: this file is evaluated by Node outside the app, so it must not
// (transitively) import react-native or any Expo runtime module.
// Expo's config loader resolves local TS imports only with an explicit `.ts` extension, which
// tsc rejects without `allowImportingTsExtensions`; the types still resolve via the expect-error.
// @ts-expect-error TS5097: explicit extension required by Expo's config evaluator (SDK 57).
import { darkColors, lightColors } from './src/theme/colors.ts';

type PluginEntry = string | [string, Record<string, unknown>];

const SPLASH_PLUGIN = 'expo-splash-screen';

/** Fills the splash plugin's background colours from the theme `ground` tokens. */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'GF Platform',
  slug: config.slug ?? 'gf-platform',
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
