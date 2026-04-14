import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { showApiError, showSuccess } from '@/lib/api-errors';

interface UseApiMutationOptions<TData, TVariables> {
  /** i18n key shown as success toast */
  successKey?: string;
  /** i18n key used as fallback when the API error has no translatable code */
  errorKey?: string;
  /** Query keys to invalidate on success */
  invalidateKeys?: string[][];
  /** Extra callback after success toast + invalidation */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Override default error handling entirely */
  onError?: (error: unknown, variables: TVariables) => void;
}

/**
 * Thin wrapper around `useMutation` that automates the
 * showSuccess / showApiError / invalidateQueries boilerplate.
 *
 * @example
 * const deleteMutation = useApiMutation(deleteFood, {
 *   successKey: 'foods.deleted',
 *   errorKey: 'foods.deleteError',
 *   invalidateKeys: [['foods']],
 * });
 */
export function useApiMutation<TData = unknown, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseApiMutationOptions<TData, TVariables> = {},
) {
  const queryClient = useQueryClient();

  const mutationOptions: UseMutationOptions<TData, unknown, TVariables> = {
    mutationFn,
    onSuccess: (data, variables) => {
      if (options.successKey) {
        showSuccess(options.successKey);
      }
      if (options.invalidateKeys) {
        for (const key of options.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
      options.onSuccess?.(data, variables);
    },
  };

  if (options.onError) {
    mutationOptions.onError = options.onError;
  } else if (options.errorKey) {
    mutationOptions.onError = (error) => showApiError(error, options.errorKey!);
  }

  return useMutation(mutationOptions);
}
