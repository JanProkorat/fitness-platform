import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';
import type { GetClientsResponse } from '@/api/client';

export default function ClientsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<GetClientsResponse>({
    queryKey: ['clients', page],
    queryFn: () => apiClient.getClientsEndpoint(page, 20),
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteStatus(null);
    try {
      await apiClient.inviteClientEndpoint({ email: inviteEmail });
      setInviteStatus(t('clients.inviteSent'));
      setInviteEmail('');
      refetch();
    } catch {
      setInviteStatus(t('clients.inviteError'));
    }
  };

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / (data.pageSize ?? 1)) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center border-b border-border bg-[#111111] px-6 py-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold">{t('clients.title')}</h1>
          <p className="text-xs text-muted">
            {t('clients.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
        >
          {t('clients.inviteClient')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Invite dialog */}
        {showInvite && (
          <div className="mb-5 rounded-sm border border-gold-dim/30 bg-gold/5 p-5">
            <div className="mb-3 text-sm font-semibold">
              {t('clients.inviteNewClient')}
            </div>
            <form onSubmit={handleInvite} className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@klient.cz"
                required
                className="flex-1 rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-gold/40"
              />
              <button
                type="submit"
                className="rounded-sm bg-gold px-5 py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
              >
                {t('common.send')}
              </button>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="rounded-sm border border-border px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-wide text-text3 transition-colors hover:text-text"
              >
                {t('common.cancel')}
              </button>
            </form>
            {inviteStatus && (
              <p
                className={`mt-2 text-xs ${inviteStatus === t('clients.inviteError') ? 'text-red' : 'text-green-bright'}`}
              >
                {inviteStatus}
              </p>
            )}
          </div>
        )}

        {/* Client list */}
        <div className="rounded-sm border border-border bg-surface">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-text3">
              {t('common.loading')}
            </div>
          ) : !data?.clients?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-text3">
              <span className="text-4xl">&#x1F465;</span>
              <p className="mt-3 text-sm">{t('clients.noClients')}</p>
              <p className="mt-1 text-xs text-muted">
                {t('clients.noClientsHint')}
              </p>
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
                    className="grid grid-cols-[1fr_1fr_120px] items-center gap-4 border-b border-charcoal px-5 py-3 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border-[1.5px] border-gold/30 bg-gold/10 font-heading text-xs font-bold text-gold">
                        {initials}
                      </div>
                      <span className="text-sm font-semibold">
                        {client.firstName} {client.lastName}
                      </span>
                    </div>
                    <span className="text-sm text-text2">{client.email}</span>
                    <div className="text-right">
                      <a
                        href={`/clients/${client.publicId}`}
                        className="font-heading text-xs font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
                      >
                        {t('common.detail')} &rarr;
                      </a>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <span className="text-xs text-muted">
                    {t('common.page', { current: page, total: totalPages })} &middot; {t('common.total', { count: data.totalCount })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded-sm border border-border px-3 py-1 text-xs text-text3 transition-colors hover:text-gold disabled:opacity-30"
                    >
                      &larr; {t('common.previous')}
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-sm border border-border px-3 py-1 text-xs text-text3 transition-colors hover:text-gold disabled:opacity-30"
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
    </div>
  );
}
