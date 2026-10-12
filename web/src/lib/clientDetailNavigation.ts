/** Router state a screen can pass when linking to client detail so the back arrow returns there. */
export interface ClientDetailLocationState {
  returnTo?: string;
}

const DEFAULT_BACK_PATH = '/clients';

/** Returns the caller-supplied return path when it is an in-app absolute path, else the clients list. */
export function getClientDetailBackPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) {
    return DEFAULT_BACK_PATH;
  }
  const { returnTo } = state;
  // Reject protocol-relative ("//host") and backslash forms that could leave the app.
  if (typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\')) {
    return returnTo;
  }
  return DEFAULT_BACK_PATH;
}
