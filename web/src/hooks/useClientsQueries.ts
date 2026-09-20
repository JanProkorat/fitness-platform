import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClientListStatus } from '@/api/generated';
import { getClients, getPendingClients, type GetClientsResult } from '@/api/clients';
import {
  getClientTags,
  createClientTag,
  updateClientTag,
  deleteClientTag,
  replaceClientTagAssignments,
  type CreateClientTagRequest,
  type UpdateClientTagRequest,
} from '@/api/client-tags';
import { broadcastMessage, type BroadcastMessageRequest } from '@/api/broadcast';
import { createPendingInvite, deletePendingInvite, type CreatePendingInviteRequest } from '@/api/pending-invites';
import { acceptClientRequest, rejectClientRequest } from '@/api/client-requests';
import { showApiError, showSuccess } from '@/lib/api-errors';
import type { ClientListFilters, ClientListTab } from '@/hooks/useClientListParams';

/**
 * Maps the page's tab — including the virtual `Pending` tab, which has no
 * corresponding `ClientListStatus` member — to the status the list endpoint
 * accepts. `Pending` maps to `Active` because **`tabCounts`** is computed with
 * `search` and `tagIds` applied but never the tab or the chip (see the
 * `ClientTabCounts` doc comment in generated.ts), so it is identical whatever
 * `status` is sent — which is what the Pending tab needs, since its own badge
 * lives on this response while its rows come from `usePendingClients()`.
 * Note the badges therefore DO move with search and tags; it is only the tab
 * and chip they ignore.
 *
 * `filterCounts` is **not** status-independent — it is scoped to the current
 * tab (see the `ClientFilterCounts` doc comment in generated.ts). That is
 * harmless only because the chips are hidden on the Pending tab, so the
 * Active-scoped counts are never rendered there. Show the chips on Pending
 * and this mapping starts lying.
 */
function tabToStatus(tab: ClientListTab): ClientListStatus {
  switch (tab) {
    case 'Paused':
      return ClientListStatus.Paused;
    case 'Archived':
      return ClientListStatus.Archived;
    case 'Active':
    case 'Pending':
    default:
      return ClientListStatus.Active;
  }
}

/**
 * The trainer's clients list, filtered/paginated per `filters`.
 *
 * Deliberately kept **enabled on all four tabs**, including Pending: the
 * counts each tab/chip badge shows live only on this response (there is no
 * separate "counts" endpoint), so disabling this query while Pending is
 * active would blank every tab's badge count instead of just skipping the
 * Pending tab's own (nonexistent) rows. Do not "optimise" this away.
 *
 * `tagIdsKey` is a stable primitive (`[...tagIds].sort().join(',')`) so that
 * selecting the same tags in a different click order hits one cache entry
 * instead of two. `pageSize` stays in the key even though it is currently
 * constant, so a future page-size control doesn't silently collide caches.
 */
export function useClients(filters: ClientListFilters) {
  const tagIdsKey = [...filters.tagIds].sort().join(',');

  return useQuery({
    queryKey: [
      'clients',
      'list',
      {
        tab: filters.tab,
        search: filters.search,
        chip: filters.chip,
        tagIdsKey,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    ],
    queryFn: () =>
      getClients({
        page: filters.page,
        pageSize: filters.pageSize,
        tagIds: filters.tagIds,
        search: filters.search || undefined,
        status: tabToStatus(filters.tab),
        filter: filters.chip,
      }),
    placeholderData: keepPreviousData,
  });
}

/** The trainer's Pending-tab rows (unaccepted invites + incoming requests). Unpaginated. */
export function usePendingClients() {
  return useQuery({
    queryKey: ['clients', 'pending'],
    queryFn: getPendingClients,
  });
}

/** The caller's client tags, for the tag picker and the filter's tag multi-select. */
export function useClientTags() {
  return useQuery({
    queryKey: ['clientTags'],
    queryFn: getClientTags,
  });
}

/**
 * Creates a client tag. No optimistic insert — the server mints the id and
 * enforces per-owner name uniqueness (CLIENT_TAG_NAME_ALREADY_EXISTS), which
 * is a real error the user must see, not something to paper over locally.
 */
export function useCreateClientTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateClientTagRequest) => createClientTag(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientTags'] });
    },
    onError: (error) => {
      showApiError(error, 'clients.tags.createError');
    },
  });
}

export interface UpdateClientTagVariables {
  tagId: string;
  request: UpdateClientTagRequest;
}

export function useUpdateClientTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: UpdateClientTagVariables) => updateClientTag(variables.tagId, variables.request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientTags'] });
      // Tag name/color is denormalised onto every client row's `tags` array.
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      showApiError(error, 'clients.tags.updateError');
    },
  });
}

export function useDeleteClientTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => deleteClientTag(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientTags'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      showApiError(error, 'clients.tags.deleteError');
    },
  });
}

export interface AssignClientTagsVariables {
  /**
   * ClientProfile.PublicId — the same id `ClientSummary.publicId` carries.
   * NOT `ClientSummary.userId` (that's ApplicationUser.Id, the Mongo/messaging
   * join key — see `ClientSummary.userId`'s own doc comment in generated.ts).
   * Verified against the backend endpoint: `ReplaceClientTagAssignmentsEndpoint`
   * resolves `{ClientId}` via `ClientProfile.PublicId`.
   */
  clientPublicId: string;
  tagIds: string[];
}

/**
 * Replaces one client's tag assignments. Deliberately **not** optimistic:
 * the row lives in a server-filtered, server-paginated, server-counted
 * list, so an optimistic edit could move the row to another page, change
 * the counts, or make it vanish under an active tag filter before the
 * server has actually agreed to the change. Instead this patches only the
 * one row from the mutation response via `setQueriesData`, then invalidates
 * `['clients']` so `tabCounts`/`filterCounts` re-settle behind it.
 */
export function useAssignClientTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: AssignClientTagsVariables) =>
      replaceClientTagAssignments(variables.clientPublicId, variables.tagIds),
    onSuccess: (response) => {
      queryClient.setQueriesData<GetClientsResult>({ queryKey: ['clients', 'list'] }, (previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          clients: previous.clients.map((client) =>
            client.publicId === response.clientId
              ? {
                  ...client,
                  tags: (response.tags ?? []).map((tag) => ({
                    tagId: tag.tagId,
                    name: tag.name,
                    colorHex: tag.colorHex,
                  })),
                }
              : client,
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      showApiError(error, 'clients.tags.assignError');
    },
  });
}

/** Sends the same text message to several selected clients at once. */
export function useBroadcastMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: BroadcastMessageRequest) => broadcastMessage(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      showSuccess('clients.broadcast.success');
    },
    onError: (error) => {
      showApiError(error, 'clients.broadcast.error');
    },
  });
}

/** Invites a new prospective client (the "+ Add client" drawer). */
export function useCreatePendingInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreatePendingInviteRequest) => createPendingInvite(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      showSuccess('clients.addClient.success');
    },
    onError: (error) => {
      showApiError(error, 'clients.addClient.error');
    },
  });
}

/** Cancels an outstanding invite from the Pending tab. */
export function useCancelPendingInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => deletePendingInvite(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      showApiError(error, 'clients.pending.cancelError');
    },
  });
}

export interface AcceptClientRequestVariables {
  publicId: string;
  questionnairePublicId?: string | null;
  statement?: string;
}

/** Accepts an incoming client request from the Pending tab. */
export function useAcceptClientRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: AcceptClientRequestVariables) =>
      acceptClientRequest(variables.publicId, variables.questionnairePublicId, variables.statement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      showApiError(error, 'clients.pending.acceptError');
    },
  });
}

export interface RejectClientRequestVariables {
  publicId: string;
  statement?: string;
}

/** Rejects an incoming client request from the Pending tab. */
export function useRejectClientRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: RejectClientRequestVariables) => rejectClientRequest(variables.publicId, variables.statement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      showApiError(error, 'clients.pending.rejectError');
    },
  });
}
