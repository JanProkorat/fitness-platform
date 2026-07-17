import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/lib/api-errors';

interface UseApiMutationOptions<TData, TVariables> {
  /** i18n key used as fallback when the API error has no translatable code */
  errorKey?: string;
  /** Query keys to invalidate on success */
  invalidateKeys?: string[][];
  /** Extra callback after invalidation */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Override default error handling entirely */
  onError?: (error: unknown, variables: TVariables) => void;
}

/**
 * Thin wrapper around `useMutation` that automates the invalidateQueries
 * boilerplate.
 *
 * NOTE: the success/error **toast** dispatch (`showSuccess`/`showApiError`)
 * was removed with the UI strip (feature/ui-redesign) — `stores/toast.ts`
 * and the `Toast` component no longer exist. `errorKey` is still resolved
 * through `getApiErrorMessage()` and handed to `onError` so a future toast
 * (or any other notification surface) can be wired back in without
 * re-deriving the translated message. Re-add a `successKey` -> toast path
 * once the new design system's notification component lands.
 *
 * @example
 * const deleteMutation = useApiMutation(deleteFood, {
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
    const errorKey = options.errorKey;
    mutationOptions.onError = (error) => {
      // Not yet surfaced to the user anywhere — see note above. Logged so
      // failures aren't silently swallowed during the scaffold period.
      console.error(getApiErrorMessage(error, errorKey), error);
    };
  }

  return useMutation(mutationOptions);
}
