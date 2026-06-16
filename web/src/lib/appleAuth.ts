/**
 * Apple Sign-In helper — loads the Apple JS SDK on demand and invokes the
 * popup-mode sign-in flow.
 *
 * The SDK is loaded once (idempotent). Service ID and redirect URI come from
 * Vite env vars (VITE_APPLE_CLIENT_ID / VITE_APPLE_REDIRECT_URI) so no URLs
 * are hardcoded (rules/code-quality.md#no-hardcoded-api-urls).
 */

/** Typed subset of the Apple JS SDK response we consume. */
interface AppleSignInAuthorizationResult {
  authorization: {
    /** Apple identity token (JWT). This is what POST /auth/social/apple expects. */
    id_token: string;
    /** Authorization code — forwarded in the request body for forward-compat. */
    code: string;
  };
  /**
   * Present only on first authorization. Absent on subsequent sign-ins.
   * Apple sends user info only once; we must persist it on first use.
   */
  user?: {
    name?: {
      firstName?: string | null;
      lastName?: string | null;
    };
    email?: string | null;
  };
}

/**
 * Shape returned by the SDK's AppleID.auth.signIn() promise.
 * The full SDK object has many more fields; we type only what we use.
 * The `unknown` cast below is a deliberate interop escape: the Apple JS SDK
 * ships no official TypeScript types and window.AppleID is dynamically
 * injected, so we can't derive the shape statically. This is the narrowest
 * safe cast — we extract named fields immediately and do not propagate `any`.
 */
interface AppleIDAuth {
  init(config: {
    clientId: string;
    scope: string;
    redirectURI: string;
    usePopup: boolean;
    nonce?: string;
  }): void;
  signIn(): Promise<AppleSignInAuthorizationResult>;
}

interface AppleIDGlobal {
  auth: AppleIDAuth;
}

/**
 * Result shape returned to callers of signInWithApple().
 */
export interface AppleSignInResult {
  identityToken: string;
  authorizationCode: string;
  firstName?: string;
  lastName?: string;
}

// Singleton promise so concurrent callers share one in-flight load.
let sdkLoadPromise: Promise<void> | null = null;

/**
 * Idempotently injects the Apple JS SDK script and resolves once
 * window.AppleID is available.
 */
function loadAppleSdk(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    // Already loaded by a previous call (e.g. hot reload).
    if ((window as { AppleID?: AppleIDGlobal }).AppleID) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src =
      'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => {
      if ((window as { AppleID?: AppleIDGlobal }).AppleID) {
        resolve();
      } else {
        reject(new Error('Apple JS SDK loaded but window.AppleID is missing'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Apple JS SDK'));
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

/**
 * Options for signInWithApple.
 */
export interface SignInWithAppleOptions {
  /**
   * A raw nonce obtained from POST /auth/social/nonce. Apple embeds
   * SHA-256(nonce) into the id_token's nonce claim; the web client does NOT
   * hash it — the backend does the comparison.
   */
  nonce: string;
}

/**
 * Initiates Apple Sign-In via the popup/JS-callback flow.
 *
 * Reads clientId + redirectURI from Vite env:
 *   VITE_APPLE_CLIENT_ID   — Apple Services ID (e.g. com.example.app.web)
 *   VITE_APPLE_REDIRECT_URI — Must match the domain registered in the Apple
 *                             Developer portal (e.g. https://app.example.com)
 *
 * Returns identityToken (always), authorizationCode (always), and
 * firstName/lastName (first auth only — Apple omits them on re-auth).
 *
 * Throws if the user cancels or the SDK rejects.
 */
export async function signInWithApple({ nonce }: SignInWithAppleOptions): Promise<AppleSignInResult> {
  await loadAppleSdk();

  // The interop cast: window.AppleID is unknown at compile time because the
  // Apple JS SDK ships no TS types and is dynamically injected.  We cast via
  // unknown → AppleIDGlobal immediately and use the typed interface from here.
  const appleID = (window as unknown as { AppleID: AppleIDGlobal }).AppleID;

  appleID.auth.init({
    clientId: import.meta.env.VITE_APPLE_CLIENT_ID ?? '',
    scope: 'name email',
    redirectURI: import.meta.env.VITE_APPLE_REDIRECT_URI ?? '',
    usePopup: true,
    nonce,
  });

  const response = await appleID.auth.signIn();

  return {
    identityToken: response.authorization.id_token,
    authorizationCode: response.authorization.code,
    firstName: response.user?.name?.firstName ?? undefined,
    lastName: response.user?.name?.lastName ?? undefined,
  };
}
