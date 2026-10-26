import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeBankAccount,
  getPaymentSettings,
  paymentSettingsKey,
  sendBankAccountReauthCode,
  updatePaymentSettings,
  type ChangeBankAccountRequest,
  type UpdatePaymentSettingsRequest,
} from '@/api/payment-settings';
import { profileKeys } from '@/api/profile';
import { getErrorStatus } from '@/lib/api-errors';

/** The coach's payment settings. Fails with 403 when the subscription does not include payments. */
export function usePaymentSettings(enabled = true) {
  return useQuery({
    queryKey: paymentSettingsKey,
    queryFn: getPaymentSettings,
    enabled,
    retry: (failureCount, error) => {
      const status = getErrorStatus(error);
      return status !== 403 && status !== 404 && failureCount < 1;
    },
  });
}

/** Saving the main currency also changes the profile's "from" price, so the profile refetches. */
export function useUpdatePaymentSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['settings', 'payments'],
    mutationFn: (request: UpdatePaymentSettingsRequest) => updatePaymentSettings(request),
    onSuccess: (settings) => {
      queryClient.setQueryData(paymentSettingsKey, settings);
      return queryClient.invalidateQueries({ queryKey: profileKeys.trainer });
    },
  });
}

export function useChangeBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    // Not under ['settings']: a wrong password in the dialog must not flip the page's save-status line.
    mutationKey: ['payments', 'bankAccount'],
    mutationFn: (request: ChangeBankAccountRequest) => changeBankAccount(request),
    onSuccess: (settings) => {
      queryClient.setQueryData(paymentSettingsKey, settings);
      // Payment requests freeze the account, and the client summary reports whether one is set.
      return queryClient.invalidateQueries({ queryKey: ['payments', 'clients'] });
    },
  });
}

export function useSendBankAccountCode() {
  return useMutation({
    mutationKey: ['payments', 'bankAccountCode'],
    mutationFn: sendBankAccountReauthCode,
  });
}
