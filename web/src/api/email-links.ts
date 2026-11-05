/**
 * Email-link API module.
 *
 * Wraps the anonymous endpoints behind the turn-off link in notification emails. Both take the
 * signed token from the link and answer with the account email and the event they changed.
 */
import { apiClient } from '@/api/client';
import { NotificationEvent } from '@/api/generated';
import type { EmailLinkTurnOffResponse, EmailLinkTurnOnResponse } from '@/api/generated';

export { NotificationEvent };
export type { EmailLinkTurnOffResponse, EmailLinkTurnOnResponse };

/** POST /users/email-links/turn-off — switches the emailed event's email off. */
export function turnOffEmail(token: string): Promise<EmailLinkTurnOffResponse> {
  return apiClient.emailLinkTurnOffEndpoint({ token });
}

/** POST /users/email-links/turn-on — switches the same email back on. */
export function turnOnEmail(token: string): Promise<EmailLinkTurnOnResponse> {
  return apiClient.emailLinkTurnOnEndpoint({ token });
}
