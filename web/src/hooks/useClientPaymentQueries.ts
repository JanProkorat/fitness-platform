import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addClientOneOffPayment,
  getClientPaymentHistory,
  getClientPaymentSummary,
  listActiveDiscounts,
  listActivePackages,
  listClientPaymentRows,
  markClientPaymentPaid,
  requestClientPayment,
  setClientPaymentTerms,
  waiveClientPayment,
  type AddClientOneOffPaymentRequest,
  type MarkClientPaymentPaidRequest,
  type RequestClientPaymentRequest,
  type SetClientPaymentTermsRequest,
  type WaiveClientPaymentRequest,
} from '@/api/client-payments';
import { getErrorStatus } from '@/lib/api-errors';

/** Prefixes shared with the packages and discounts pages, so an invalidation reaches both. */
export const paymentPackagesKey = ['payments', 'packages'] as const;
export const paymentDiscountsKey = ['payments', 'discounts'] as const;

export const clientPaymentKeys = {
  client: (clientId: string) => ['payments', 'clients', clientId] as const,
  summary: (clientId: string) => ['payments', 'clients', clientId, 'summary'] as const,
  rows: (clientId: string) => ['payments', 'clients', clientId, 'rows'] as const,
  history: (clientId: string) => ['payments', 'clients', clientId, 'history'] as const,
};

/** A 403 (not entitled) or 404 (no live link) will not change by asking again. */
function retryUnlessDenied(failureCount: number, error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 403 || status === 404) {
    return false;
  }
  return failureCount < 1;
}

/** Package, price, next payment and progress of one client. Fails with 403 / 404. */
export function useClientPaymentSummary(clientId: string) {
  return useQuery({
    queryKey: clientPaymentKeys.summary(clientId),
    queryFn: () => getClientPaymentSummary(clientId),
    enabled: Boolean(clientId),
    retry: retryUnlessDenied,
  });
}

export function useClientPaymentRows(clientId: string, enabled: boolean) {
  return useQuery({
    queryKey: clientPaymentKeys.rows(clientId),
    queryFn: () => listClientPaymentRows(clientId),
    enabled: Boolean(clientId) && enabled,
    retry: retryUnlessDenied,
  });
}

export function useClientPaymentHistory(clientId: string, enabled: boolean) {
  return useQuery({
    queryKey: clientPaymentKeys.history(clientId),
    queryFn: () => getClientPaymentHistory(clientId),
    enabled: Boolean(clientId) && enabled,
    retry: retryUnlessDenied,
  });
}

/** The coach's active packages. Its own entry under the shared prefix: the shape is the plain list. */
export function usePaymentPackages(enabled: boolean) {
  return useQuery({
    queryKey: [...paymentPackagesKey, 'active'] as const,
    queryFn: listActivePackages,
    enabled,
    retry: retryUnlessDenied,
  });
}

/** The coach's active discounts. */
export function usePaymentDiscounts(enabled: boolean) {
  return useQuery({
    queryKey: [...paymentDiscountsKey, 'active'] as const,
    queryFn: listActiveDiscounts,
    enabled,
    retry: retryUnlessDenied,
  });
}

/** Every write refetches the summary, the rows and the history together: one change moves all three. */
function useRefetchClientPayments(clientId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: clientPaymentKeys.client(clientId) });
}

/** Refetches everything on the client page that depends on a live link, so it can switch to the ended view. */
export function useInvalidateClientLinkState(clientId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['client-dashboard', clientId] }),
      queryClient.invalidateQueries({ queryKey: clientPaymentKeys.client(clientId) }),
    ]);
}

/**
 * Asks the payment summary, which still answers for an ended link, whether the collaboration ended.
 * When it did, the page's queries are refreshed so it switches to the ended view.
 */
export function useCheckCollaborationEnded(clientId: string) {
  const queryClient = useQueryClient();
  const invalidateLinkState = useInvalidateClientLinkState(clientId);
  return async (): Promise<boolean> => {
    try {
      const summary = await queryClient.fetchQuery({
        queryKey: clientPaymentKeys.summary(clientId),
        queryFn: () => getClientPaymentSummary(clientId),
        staleTime: 0,
        retry: retryUnlessDenied,
      });
      if (summary.collaborationEnded !== true) {
        return false;
      }
    } catch {
      return false;
    }
    await invalidateLinkState();
    return true;
  };
}

/** Setting terms also changes the package and discount client counts. */
export function useSetClientPaymentTerms(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SetClientPaymentTermsRequest) => setClientPaymentTerms(clientId, request),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: clientPaymentKeys.client(clientId) }),
        queryClient.invalidateQueries({ queryKey: paymentPackagesKey }),
        queryClient.invalidateQueries({ queryKey: paymentDiscountsKey }),
      ]),
  });
}

export function useMarkClientPaymentPaid(clientId: string) {
  const refetch = useRefetchClientPayments(clientId);
  return useMutation({
    mutationFn: (variables: { paymentId: string; request: MarkClientPaymentPaidRequest }) =>
      markClientPaymentPaid(clientId, variables.paymentId, variables.request),
    // A 409 means the row was settled elsewhere; refetching shows it as it is now.
    onSettled: () => refetch(),
  });
}

export function useWaiveClientPayment(clientId: string) {
  const refetch = useRefetchClientPayments(clientId);
  return useMutation({
    mutationFn: (variables: { paymentId: string; request: WaiveClientPaymentRequest }) =>
      waiveClientPayment(clientId, variables.paymentId, variables.request),
    onSettled: () => refetch(),
  });
}

export function useRequestClientPayment(clientId: string) {
  const refetch = useRefetchClientPayments(clientId);
  return useMutation({
    mutationFn: (variables: { paymentId: string; request: RequestClientPaymentRequest }) =>
      requestClientPayment(clientId, variables.paymentId, variables.request),
    onSettled: () => refetch(),
  });
}

export function useAddClientOneOffPayment(clientId: string) {
  const refetch = useRefetchClientPayments(clientId);
  return useMutation({
    mutationFn: (request: AddClientOneOffPaymentRequest) => addClientOneOffPayment(clientId, request),
    onSettled: () => refetch(),
  });
}
