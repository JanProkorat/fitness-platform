import { api } from '@/api/client';
import { getErrorStatus, getProblemCode, isNetworkError } from '@/api/errors';

export type LoginFailure =
  | 'invalidCredentials'
  | 'accountDeactivated'
  | 'rateLimited'
  | 'network'
  | 'generic';

export type LoginTokens = { accessToken: string; refreshToken: string };

/** Thrown when a login attempt ends in a failure the screen can name. */
export class LoginFailureError extends Error {
  readonly failure: LoginFailure;

  constructor(failure: LoginFailure) {
    super(failure);
    this.failure = failure;
  }
}

/** Calls the login endpoint and returns both tokens, or throws. */
export async function login(email: string, password: string): Promise<LoginTokens> {
  const response = await api.loginEndpoint({ email, password });
  const { accessToken, refreshToken } = response;
  if (!accessToken || !refreshToken) {
    throw new LoginFailureError('generic');
  }
  return { accessToken, refreshToken };
}

/** Maps anything `login` can throw to the failure the screen shows. */
export function classifyLoginError(error: unknown): LoginFailure {
  if (error instanceof LoginFailureError) return error.failure;
  if (isNetworkError(error)) return 'network';
  if (getErrorStatus(error) === 429) return 'rateLimited';
  switch (getProblemCode(error)) {
    case 'INVALID_CREDENTIALS':
      return 'invalidCredentials';
    case 'ACCOUNT_DEACTIVATED':
      return 'accountDeactivated';
    default:
      return 'generic';
  }
}
