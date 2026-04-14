import { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { useSignalR } from '@/hooks/useSignalR';
import { useToastStore } from '@/stores/toast';

const DARK_MODE_KEY = 'gf-dark-mode';

function getInitialDarkMode(): boolean {
  const stored = localStorage.getItem(DARK_MODE_KEY);
  if (stored !== null) {
    return stored === 'true';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function AppShell() {
  const [dark, setDark] = useState(getInitialDarkMode);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(DARK_MODE_KEY, String(dark));
  }, [dark]);

  const handleToggleDark = useCallback(() => {
    setDark((prev) => !prev);
  }, []);

  // Real-time notification handlers
  const signalRHandlers = useMemo(() => ({
    clientRequestReceived: (payload: unknown) => {
      const data = payload as { ClientFirstName?: string; ClientLastName?: string } | undefined;
      const name = data ? `${data.ClientFirstName ?? ''} ${data.ClientLastName ?? ''}`.trim() : '';
      addToast(
        name
          ? t('notifications.newClientRequest', { name })
          : t('notifications.newClientRequestGeneric'),
        'success',
      );
      queryClient.invalidateQueries({ queryKey: ['client-requests'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
      queryClient.invalidateQueries({ queryKey: ['web-notifications'] });
    },
    inviteAccepted: (payload: unknown) => {
      const data = payload as { clientName?: string } | undefined;
      addToast(
        data?.clientName
          ? t('notifications.inviteAccepted', { name: data.clientName })
          : t('notifications.inviteAcceptedGeneric'),
        'success',
      );
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
      queryClient.invalidateQueries({ queryKey: ['web-notifications'] });
    },
    inviteDeclined: (payload: unknown) => {
      const data = payload as { clientName?: string } | undefined;
      addToast(
        data?.clientName
          ? `${data.clientName} declined your invitation`
          : 'Your invitation was declined',
        'error',
      );
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
      queryClient.invalidateQueries({ queryKey: ['web-notifications'] });
    },
    questionnaireSubmitted: (payload: unknown) => {
      const data = payload as { ClientPublicId?: string; ClientName?: string; ResponsePublicId?: string } | undefined;
      const msg = data?.ClientName
        ? `${data.ClientName} — ${t('notifications.questionnaireSubmitted')}`
        : t('notifications.questionnaireSubmitted');
      addToast(msg, 'success');
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
      queryClient.invalidateQueries({ queryKey: ['web-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['client-dashboard'] });
      // Invalidate all questionnaire-responses queries — plan.clientId may
      // be the user GUID while ClientPublicId is the profile PublicId, so
      // a targeted invalidation can miss. This event is rare (only on submit).
      queryClient.invalidateQueries({ queryKey: ['questionnaire-responses'] });
    },
    clientRequestCancelled: (payload: unknown) => {
      const data = payload as { ClientName?: string } | undefined;
      addToast(
        data?.ClientName
          ? t('notifications.inviteRevoked', { name: data.ClientName })
          : t('notifications.inviteRevokedGeneric'),
        'success',
      );
      queryClient.invalidateQueries({ queryKey: ['client-requests'] });
      queryClient.invalidateQueries({ queryKey: ['web-notifications'] });
    },
    collaborationEnded: (payload: unknown) => {
      const data = payload as { ClientName?: string } | undefined;
      addToast(
        data?.ClientName
          ? t('notifications.collaborationEnded', { name: data.ClientName })
          : t('notifications.collaborationEndedGeneric'),
        'error',
      );
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
      queryClient.invalidateQueries({ queryKey: ['web-notifications'] });
    },
    newMessage: (payload: unknown) => {
      const data = payload as { conversationId?: string; senderName?: string } | undefined;
      if (data?.senderName) {
        addToast(`${data.senderName}: Nová zpráva`, 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (data?.conversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', data.conversationId] });
      }
    },
    userPresence: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    clientComplianceUpdated: (payload: unknown) => {
      const data = payload as { ClientId?: string; clientId?: string } | undefined;
      const clientId = data?.ClientId ?? data?.clientId;
      if (!clientId) return;
      // Trainer is viewing this client's detail page — refresh stats + timeline live.
      queryClient.invalidateQueries({ queryKey: ['client-dashboard', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-timeline', clientId] });
      // Main dashboard table — refresh calories, compliance, streak.
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    typing: (payload: unknown) => {
      const data = payload as { conversationId?: string; senderId?: string } | undefined;
      if (data?.conversationId) {
        queryClient.setQueryData(['typing', data.conversationId], { isTyping: true, senderId: data.senderId });
        // Clear typing after 3 seconds
        setTimeout(() => {
          queryClient.setQueryData(['typing', data.conversationId], { isTyping: false });
        }, 3000);
      }
    },
  }), [queryClient, addToast, t]);

  useSignalR(signalRHandlers);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar onToggleDark={handleToggleDark} />
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <Suspense fallback={<div className="flex flex-1 items-center justify-center text-text3">Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

export default AppShell;
