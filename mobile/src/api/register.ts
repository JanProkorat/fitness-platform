import { api } from '@/api/client';
import { ApiException } from '@/api/generated';
import type { RegisterRequest } from '@/api/generated';
import { getErrorStatus, getProblemCode, isNetworkError } from '@/api/errors';
import { ROLE_CLIENT } from '@/api/profile';

/**
 * RegisterEndpoint has no machine-readable code for a duplicate email: it passes ASP.NET
 * Identity's English description through as `errors[].reason`.
 */
const DUPLICATE_EMAIL_PATTERN = /already taken|already registered/i;

const VERIFICATION_RESEND_LIMIT_REACHED = 'VERIFICATION_RESEND_LIMIT_REACHED';
const EMAIL_ALREADY_VERIFIED = 'EMAIL_ALREADY_VERIFIED';
const INVALID_VERIFICATION_TOKEN = 'INVALID_VERIFICATION_TOKEN';
const VERIFICATION_TOKEN_EXPIRED = 'VERIFICATION_TOKEN_EXPIRED';

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roles: string[];
  gdprConsent: boolean;
  healthDataConsent: boolean;
};

export type RegisterField = 'firstName' | 'lastName' | 'email' | 'password';

export type RegisterFailure =
  | { kind: 'duplicateEmail' }
  | { kind: 'rateLimited' }
  | { kind: 'network' }
  | { kind: 'validation'; fields: RegisterField[] }
  | { kind: 'generic' };

export type ResendFailure = 'limitReached' | 'alreadyVerified' | 'rateLimited' | 'network' | 'generic';

/** The account was created but signing in with it failed; the registration must not be retried. */
export class AutoLoginError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super('auto_login_failed');
    this.cause = cause;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Creates the account. The 201 response carries no tokens, so the caller signs in afterwards. */
export async function register(input: RegisterInput): Promise<void> {
  const isClient = input.roles.includes(ROLE_CLIENT);
  const request: RegisterRequest = {
    email: input.email,
    password: input.password,
    confirmPassword: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    roles: input.roles,
    gdprConsent: input.gdprConsent,
    // The backend requires true for the client role and null for coach roles.
    healthDataConsent: isClient ? input.healthDataConsent : undefined,
  };
  await api.registerEndpoint(request);
}

/** Every `errors[]` entry of a problem body, as `{ name, reason }`. */
function readProblemEntries(error: unknown): { name: string; reason: string }[] {
  if (!isRecord(error) || !Array.isArray(error.errors)) return [];
  const entries: { name: string; reason: string }[] = [];
  for (const entry of error.errors as unknown[]) {
    if (!isRecord(entry)) continue;
    entries.push({
      name: typeof entry.name === 'string' ? entry.name : '',
      reason: typeof entry.reason === 'string' ? entry.reason : '',
    });
  }
  return entries;
}

const FIELD_BY_NAME: Record<string, RegisterField> = {
  email: 'email',
  password: 'password',
  confirmpassword: 'password',
  firstname: 'firstName',
  lastname: 'lastName',
};

/** Maps anything `register` can throw to the failure the screen shows. */
export function classifyRegisterError(error: unknown): RegisterFailure {
  if (isNetworkError(error)) return { kind: 'network' };
  const status = getErrorStatus(error);
  if (status === 429) return { kind: 'rateLimited' };
  const entries = readProblemEntries(error);
  if (entries.some((entry) => DUPLICATE_EMAIL_PATTERN.test(entry.reason))) {
    return { kind: 'duplicateEmail' };
  }
  if (status === 400) {
    const fields = entries
      .map((entry) => FIELD_BY_NAME[entry.name.toLowerCase()])
      .filter((field): field is RegisterField => field !== undefined);
    return { kind: 'validation', fields: [...new Set(fields)] };
  }
  return { kind: 'generic' };
}

/** Asks the backend to send the verification email again. */
export async function resendVerification(): Promise<void> {
  await api.resendVerificationEndpoint();
}

/** The 400 body of the resend endpoint arrives as raw text on an ApiException. */
function readResendCode(error: unknown): string | undefined {
  const direct = getProblemCode(error);
  if (direct) return direct;
  if (!(error instanceof ApiException)) return undefined;
  try {
    return getProblemCode(JSON.parse(error.response) as unknown);
  } catch {
    return undefined;
  }
}

export type VerifyFailure = 'invalid' | 'expired' | 'rateLimited' | 'network' | 'generic';

export type AnonymousResendFailure = 'rateLimited' | 'network' | 'generic';

/** The account a verification token confirmed. */
export type VerifiedAccount = {
  email: string | undefined;
  firstName: string | undefined;
  roles: string[];
};

/** Confirms the email address a verification link was issued for (POST /auth/verify-email). */
export async function verifyEmail(token: string): Promise<VerifiedAccount> {
  const response = await api.verifyEmailEndpoint({ token });
  return { email: response.email, firstName: response.firstName, roles: response.roles ?? [] };
}

/** Asks for a new verification email by address, without a session; the answer is always generic. */
export async function resendVerificationByEmail(email: string): Promise<void> {
  await api.anonymousResendVerificationEndpoint({ email });
}

/** Maps anything `verifyEmail` can throw to the failure the screen shows. */
export function classifyVerifyError(error: unknown): VerifyFailure {
  if (isNetworkError(error)) return 'network';
  if (getErrorStatus(error) === 429) return 'rateLimited';
  switch (readResendCode(error)) {
    case INVALID_VERIFICATION_TOKEN:
      return 'invalid';
    case VERIFICATION_TOKEN_EXPIRED:
      return 'expired';
    default:
      return 'generic';
  }
}

/** Maps anything `resendVerificationByEmail` can throw to the failure the screen shows. */
export function classifyAnonymousResendError(error: unknown): AnonymousResendFailure {
  if (isNetworkError(error)) return 'network';
  if (getErrorStatus(error) === 429) return 'rateLimited';
  return 'generic';
}

/** Maps anything `resendVerification` can throw to the failure the screen shows. */
export function classifyResendError(error: unknown): ResendFailure {
  if (isNetworkError(error)) return 'network';
  if (getErrorStatus(error) === 429) return 'rateLimited';
  switch (readResendCode(error)) {
    case VERIFICATION_RESEND_LIMIT_REACHED:
      return 'limitReached';
    case EMAIL_ALREADY_VERIFIED:
      return 'alreadyVerified';
    default:
      return 'generic';
  }
}
