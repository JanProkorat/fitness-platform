import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import type { GetClientsResponse } from '@/api/client';
import { showError, showSuccess } from '@/lib/api-errors';

export default function ClientsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  // Drawer
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);

  const openDrawer = useCallback(() => {
    setInviteEmail('');
    setDrawerMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerVisible(true)));
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false);
    setTimeout(() => setDrawerMounted(false), 300);
  }, []);

  const { data, isLoading, refetch } = useQuery<GetClientsResponse>({
    queryKey: ['clients', page],
    queryFn: () => apiClient.getClientsEndpoint(page, 20),
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSending(true);
    try {
      await apiClient.inviteClientEndpoint({ email: inviteEmail });
      showSuccess('clients.inviteSent');
      closeDrawer();
      refetch();
    } catch {
      showError('clients.inviteError');
    } finally {
      setSending(false);
    }
  };

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / (data.pageSize ?? 1)) : 0;

  const inputClass =
    'rounded-md border border-border-md bg-bg px-4 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text3 focus:border-border-hv';

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center border-b border-border bg-bg2 px-6 py-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold">{t('clients.title')}</h1>
          <p className="text-xs text-text3">{t('clients.subtitle')}</p>
        </div>
        <button
          onClick={openDrawer}
          className="rounded-sm bg-text px-4 py-2 text-[13px] font-medium text-bg transition-colors hover:opacity-90"
        >
          {t('clients.inviteClient')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Client list */}
        <div className="rounded-sm border border-border bg-bg2">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-text3">
              {t('common.loading')}
            </div>
          ) : !data?.clients?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-text3">
              <span className="text-4xl">&#x1F465;</span>
              <p className="mt-3 text-sm">{t('clients.noClients')}</p>
              <p className="mt-1 text-xs text-text3">{t('clients.noClientsHint')}</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_1fr_120px] gap-4 border-b border-border px-5 py-3">
                <span className="lbl">{t('common.name')}</span>
                <span className="lbl">{t('common.email')}</span>
                <span className="lbl text-right">{t('common.actions')}</span>
              </div>

              {/* Rows */}
              {data.clients!.map((client) => {
                const initials = `${(client.firstName ?? '')[0]}${(client.lastName ?? '')[0]}`.toUpperCase();
                return (
                  <div
                    key={client.publicId}
                    onClick={() => navigate(`/clients/${client.publicId}`)}
                    className="grid grid-cols-[1fr_1fr_120px] cursor-pointer items-center gap-4 border-b border-border px-5 py-3 transition-colors last:border-0 hover:bg-bg-hover"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border-[1.5px] border-accent-br bg-accent-bg text-xs font-bold text-accent">
                        {initials}
                      </div>
                      <span className="text-sm font-semibold">
                        {client.firstName} {client.lastName}
                      </span>
                    </div>
                    <span className="text-sm text-text2">{client.email}</span>
                    <div className="text-right">
                      <span className="text-xs font-semibold uppercase tracking-wide text-accent-dim">
                        {t('common.detail')} &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <span className="text-xs text-text3">
                    {t('common.page', { current: page, total: totalPages })} &middot;{' '}
                    {t('common.total', { count: data.totalCount })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded-sm border border-border px-3 py-1 text-xs text-text3 transition-colors hover:text-accent disabled:opacity-30"
                    >
                      &larr; {t('common.previous')}
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-sm border border-border px-3 py-1 text-xs text-text3 transition-colors hover:text-accent disabled:opacity-30"
                    >
                      {t('common.next')} &rarr;
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right-side drawer for inviting a client */}
      {drawerMounted && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${drawerVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeDrawer}
          />
          <div
            className={`fixed top-0 right-0 z-50 flex h-full w-[400px] flex-col border-l border-border bg-bg shadow-2xl transition-transform duration-300 ease-out ${drawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold">{t('clients.inviteNewClient')}</div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="text-text3 transition-colors hover:text-text"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="mb-5 text-sm text-text2">{t('clients.inviteDescription')}</p>

              <form id="invite-form" onSubmit={handleInvite} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-xs text-text3">
                    {t('common.email')}
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@client.com"
                    required
                    className={`w-full ${inputClass}`}
                  />
                </div>
              </form>
            </div>

            {/* Sticky send button */}
            <div className="shrink-0 border-t border-border bg-bg px-6 py-4">
              <button
                type="submit"
                form="invite-form"
                disabled={sending || !inviteEmail.trim()}
                className="w-full rounded-sm bg-text px-5 py-3 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {sending ? t('common.sending') : t('clients.sendInvite')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
