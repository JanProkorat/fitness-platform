// Dynamic Expo config — extends app.json and wires env-driven values that
// cannot be expressed as static JSON (e.g. Google Sign-In iosUrlScheme).
// `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` must be the reversed iOS OAuth client ID
// issued by Google Cloud Console (starts with "com.googleusercontent.apps.").
// `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is the Android OAuth client ID.
// Both are optional at build time; the Google button is disabled at runtime
// when the client IDs are not configured.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const baseConfig = require('./app.json');

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const iosUrlScheme = iosClientId.startsWith('com.googleusercontent.apps.')
  ? iosClientId
  : '';

/** @type {import('expo/config').ExpoConfig} */
const config = {
  ...baseConfig.expo,
  plugins: [
    ...(baseConfig.expo.plugins ?? []),
    // Add the Google Sign-In plugin only when the iOS client ID is available.
    // Without it the native URL scheme is not registered and the sign-in flow
    // will not complete the redirect on iOS. This keeps CI builds clean when
    // neither client ID env var is set.
    ...(iosUrlScheme
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme }]]
      : []),
  ],
};

module.exports = { expo: config };
