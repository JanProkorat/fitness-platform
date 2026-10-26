/**
 * Payment settings API module.
 *
 * Wraps the NSwag-generated coach payment-settings endpoints: the request defaults, the main
 * currency, and the re-authenticated bank account change with its emailed undo link.
 */
import { apiClient } from '@/api/client';
import { PaymentCurrency, PaymentMessageFormat, VariableSymbolFormat } from '@/api/generated';
import type {
  ChangeBankAccountRequest,
  PaymentSettingsDto,
  UpdatePaymentSettingsRequest,
} from '@/api/generated';

export { PaymentCurrency, PaymentMessageFormat, VariableSymbolFormat };
export type { ChangeBankAccountRequest, PaymentSettingsDto, UpdatePaymentSettingsRequest };

export const paymentSettingsKey = ['payments', 'settings'] as const;

export function getPaymentSettings(): Promise<PaymentSettingsDto> {
  return apiClient.getPaymentSettingsEndpoint();
}

/** PUT /payments/settings — a full replace of the defaults; the currency is kept when omitted. */
export function updatePaymentSettings(request: UpdatePaymentSettingsRequest): Promise<PaymentSettingsDto> {
  return apiClient.updatePaymentSettingsEndpoint(request);
}

/** PUT the bank account; needs the password, or the emailed code for an account with no password. */
export function changeBankAccount(request: ChangeBankAccountRequest): Promise<PaymentSettingsDto> {
  return apiClient.changeBankAccountEndpoint(request);
}

/** POST — emails a one-time code to an account that has no password (204). */
export function sendBankAccountReauthCode(): Promise<void> {
  return apiClient.sendBankAccountReauthCodeEndpoint();
}

/** POST — restores the previous bank account from the emailed single-use token (204). */
export function undoBankAccountChange(token: string): Promise<void> {
  return apiClient.undoBankAccountChangeEndpoint({ token });
}
