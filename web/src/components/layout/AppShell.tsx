import { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { useSignalR } from '@/hooks/useSignalR';
import { useToastStore } from '@/stores/toast';
import { isTrainingProgressUpdatedEvent } from '@/api/trainingProgressEvent';
import { isPersonalRecordAchievedEvent } from '@/api/personalRecordEvent';
import { weeklyCheckInKeys } from '@/hooks/useWeeklyCheckIns';

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
    trainingprogressupdated: (payload: unknown) => {
      // The backend broadcasts this event only to the trainer who owns the client
      // (per-user SignalR group), so no client-id filtering is needed here.
      if (import.meta.env.DEV) {
        console.debug('trainingprogressupdated', payload);
      }
      if (!isTrainingProgressUpdatedEvent(payload)) {
        if (import.meta.env.DEV) {
          console.warn('trainingprogressupdated: invalid payload shape', payload);
        }
        return;
      }
      const clientId = payload.clientId;

      // `sessionId` may be null (whole-day broadcast aggregates across sessions);
      // handler is intentionally sessionId-agnostic — we invalidate the same keys either way.
      // Refresh the main dashboard table — drives avg compliance pill,
      // low-compliance alert count, per-client compliance/streak cells,
      // and the low-compliance callouts.  All of these are derived from
      // the single ['dashboard-summary'] query (DashboardPage.tsx line 87-91).
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });

      // If the trainer has the per-client detail page open, refresh its
      // stats panel and activity timeline as well.
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ['client-dashboard', clientId] });
        queryClient.invalidateQueries({ queryKey: ['client-timeline', clientId] });
      }
    },
    personalrecordachieved: (payload: unknown) => {
      if (import.meta.env.DEV) {
        console.debug('personalrecordachieved', payload);
      }
      if (!isPersonalRecordAchievedEvent(payload)) {
        if (import.meta.env.DEV) {
          console.warn('personalrecordachieved: invalid payload shape', payload);
        }
        return;
      }
      const { clientId, exerciseName } = payload;

      // Toast notification so the trainer sees the PR regardless of which page they are on.
      addToast(
        t('notifications.personalRecordAchieved', { exerciseName }),
        'success',
      );

      // Invalidate the client's activity timeline — the new personal_record entry
      // will appear there once the query refetches.
      // Key shape verified: ClientDetailPage.tsx line 31 uses ['client-timeline', id].
      queryClient.invalidateQueries({ queryKey: ['client-timeline', clientId] });

      // Invalidate the per-client stats panel (streak, compliance, etc.).
      // Key shape verified: ClientDetailPage.tsx line 25 uses ['client-dashboard', id].
      queryClient.invalidateQueries({ queryKey: ['client-dashboard', clientId] });

      // Invalidate the trainer's dashboard summary — the PR represents a completed
      // workout that may update streak / training count cells in the client table.
      // Key shape verified: DashboardPage.tsx line 88 uses ['dashboard-summary'].
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    planphotouploaded: (payload: unknown) => {
      const data = payload as { planId?: string } | undefined;
      const planId = data?.planId;
      if (planId) {
        queryClient.invalidateQueries({ queryKey: ['planPhotos', planId] });
      } else {
        // Broad invalidation if planId is missing
        queryClient.invalidateQueries({ queryKey: ['planPhotos'] });
      }
    },
    weeklycheckinupdated: (payload: unknown) => {
      if (import.meta.env.DEV) {
        console.debug('weeklycheckinupdated', payload);
      }
      // Invalidate all weekly check-in queries (trainer list + all client-current variants).
      // The payload carries { id, respondedAt?, reviewedAt?, dismissedAt? } but we do a
      // broad invalidation so every open banner and card refreshes consistently.
      const data = payload as { id?: string } | undefined;
      void data; // payload available for future fine-grained invalidation
      queryClient.invalidateQueries({ queryKey: weeklyCheckInKeys.all });
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
