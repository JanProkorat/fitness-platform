/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth client ID for @react-oauth/google. */
  readonly VITE_GOOGLE_CLIENT_ID: string;
  /** Apple Services ID for Apple Sign-In (e.g. com.example.app.web). */
  readonly VITE_APPLE_CLIENT_ID: string;
  /**
   * Redirect URI registered in the Apple Developer portal for this web app.
   * Must match exactly (e.g. https://app.example.com).
   */
  readonly VITE_APPLE_REDIRECT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
