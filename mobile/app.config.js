// Dynamic Expo config — extends app.json and wires env-driven values that
// cannot be expressed as static JSON.
// EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID are
// the OAuth client IDs issued by Google Cloud Console.
// EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is the Android client ID.
// All are optional at build time; the Google button is disabled at runtime
// when the client IDs are not configured.
// The expo-auth-session Google provider handles the OAuth redirect URL
// automatically — no native URL scheme registration is required.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const baseConfig = require('./app.json');

/** @type {import('expo/config').ExpoConfig} */
const config = {
  ...baseConfig.expo,
  plugins: [...(baseConfig.expo.plugins ?? [])],
};

module.exports = { expo: config };
