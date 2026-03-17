import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';
import type { ClientSummary } from '@/api/client';

interface ClientSelectProps {
  value: string;
  onChange: (clientId: string) => void;
}

export default function ClientSelect({ value, onChange }: ClientSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<ClientSummary | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['clients-select', debouncedSearch],
    queryFn: () => apiClient.getClientsEndpoint(1, 50, debouncedSearch || undefined),
    enabled: open,
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (client: ClientSummary) => {
    setSelected(client);
    onChange(client.publicId);
    setSearch('');
    setOpen(false);
  };

  const displayValue = selected
    ? `${selected.firstName} ${selected.lastName}`
    : value
      ? value
      : '';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mt-1 flex w-full items-center justify-between rounded-sm border border-border bg-surface px-4 py-2.5 text-left text-sm text-text outline-none transition-colors focus:border-gold/40"
      >
        <span className={displayValue ? 'text-text' : 'text-text3'}>
          {displayValue || t('nutrition.selectClient')}
        </span>
        <svg
          className={`h-4 w-4 text-text3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-sm border border-border bg-surface shadow-lg">
          <div className="border-b border-border p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('nutrition.searchClient')}
              autoFocus
              className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-gold/40"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-3 text-xs text-text3">{t('common.loading')}</div>
            ) : !data?.clients?.length ? (
              <div className="px-4 py-3 text-xs text-text3">{t('clients.noClients')}</div>
            ) : (
              data.clients.map((client) => (
                <button
                  key={client.publicId}
                  type="button"
                  onClick={() => handleSelect(client)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gold/5 ${
                    client.publicId === value ? 'bg-gold/10 text-gold' : 'text-text'
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-gold/10 text-[10px] font-bold text-gold">
                    {client.firstName[0]}{client.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {client.firstName} {client.lastName}
                    </div>
                    <div className="truncate text-xs text-text3">{client.email}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
