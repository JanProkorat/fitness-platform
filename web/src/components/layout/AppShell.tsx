import { useState, useCallback, useEffect, useMemo } from 'react';
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
    },
    questionnaireSubmitted: () => {
      addToast(t('notifications.questionnaireSubmitted'), 'success');
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
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
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
