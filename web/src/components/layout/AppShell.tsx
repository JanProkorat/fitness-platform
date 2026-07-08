import { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { useSignalR } from '@/hooks/useSignalR';
import { useToastStore } from '@/stores/toast';
import { useTrainingPlanStore } from '@/stores/trainingPlan';
import { isTrainingProgressUpdatedEvent } from '@/api/trainingProgressEvent';
import { isPersonalRecordAchievedEvent } from '@/api/personalRecordEvent';
import { isSessionEditLockChangedEvent } from '@/api/sessionEditLockEvent';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sidebarOpen]);

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
          ? t('notifications.inviteDeclined', { name: data.clientName })
          : t('notifications.inviteDeclinedGeneric'),
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
        addToast(t('notifications.newMessage', { name: data.senderName }), 'success');
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

      // If the trainer also has THIS client's plan open in the editor,
      // pull the latest completions, session executions, and lock states so
      // the finished badge and unlock affordance update in real time.
      // Only server-owned slices are replaced — unsaved trainer edits stay intact.
      const tp = useTrainingPlanStore.getState();
      if (tp.plan && tp.plan.clientId === clientId) {
        void tp.refreshCompletions();
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
        // Key shape: ['planPhotos', clientId, planId] — planId lives at index 2.
        // Use a predicate so we match regardless of clientId (not in the payload).
        queryClient.invalidateQueries({
          predicate: (q) =>
            q.queryKey[0] === 'planPhotos' && q.queryKey[2] === planId,
        });
      } else {
        // Broad invalidation if planId is missing from the payload
        queryClient.invalidateQueries({ queryKey: ['planPhotos'] });
      }
    },
    // ── Photo diary real-time events (from #94 / #97) ────────────────────────
    // Every handler below ALSO invalidates the bare ['diary-requests'] prefix
    // in addition to the plan-scoped key. TanStack Query's invalidateQueries
    // is prefix-match only — a plan-scoped invalidation (['diary-requests',
    // planId]) can never reach FotkyTab's client-scoped query key
    // (['diary-requests', clientId]), since neither is a prefix of the other.
    // Broadening to always also hit the bare key keeps FotkyTab (and any
    // other client-scoped consumer) in sync regardless of whether the event
    // payload carried a planId (#614).
    photodiaryrequested: (payload: unknown) => {
      const data = payload as { planId?: string } | undefined;
      if (data?.planId) {
        queryClient.invalidateQueries({ queryKey: ['diary-requests', data.planId] });
      }
      queryClient.invalidateQueries({ queryKey: ['diary-requests'] });
    },
    photodiaryaccepted: (payload: unknown) => {
      // Client just accepted a Pending request — flip its status chip
      // (Pending → Accepted/InProgress) on any open diary card.
      const data = payload as { planId?: string } | undefined;
      if (data?.planId) {
        queryClient.invalidateQueries({ queryKey: ['diary-requests', data.planId] });
      }
      queryClient.invalidateQueries({ queryKey: ['diary-requests'] });
    },
    photodiarydismissed: (payload: unknown) => {
      const data = payload as { planId?: string } | undefined;
      if (data?.planId) {
        queryClient.invalidateQueries({ queryKey: ['diary-requests', data.planId] });
      }
      queryClient.invalidateQueries({ queryKey: ['diary-requests'] });
    },
    photodiaryphotouploaded: (payload: unknown) => {
      // Diary photo uploads re-use the planphotouploaded path for the photo
      // grid; here we also refresh the diary request status (InProgress count).
      const data = payload as { planId?: string } | undefined;
      if (data?.planId) {
        // ['diary-requests', planId] — correct 2-element key; unchanged.
        queryClient.invalidateQueries({ queryKey: ['diary-requests', data.planId] });
        // Key shape: ['planPhotos', clientId, planId] — planId lives at index 2.
        // Use a predicate so we match regardless of clientId (not in the payload).
        queryClient.invalidateQueries({
          predicate: (q) =>
            q.queryKey[0] === 'planPhotos' && q.queryKey[2] === data.planId,
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['planPhotos'] });
      }
      queryClient.invalidateQueries({ queryKey: ['diary-requests'] });
    },
    photodiarysubmitted: (payload: unknown) => {
      const data = payload as { planId?: string } | undefined;
      if (data?.planId) {
        queryClient.invalidateQueries({ queryKey: ['diary-requests', data.planId] });
      }
      queryClient.invalidateQueries({ queryKey: ['diary-requests'] });
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
    sessioneditlockchanged: (payload: unknown) => {
      if (import.meta.env.DEV) {
        console.debug('sessioneditlockchanged', payload);
      }
      if (!isSessionEditLockChangedEvent(payload)) {
        if (import.meta.env.DEV) {
          console.warn('sessioneditlockchanged: invalid payload shape', payload);
        }
        return;
      }

      // The trainer's main dashboard table shows per-client training activity.
      // A lock change (session started, completed, or trainer unlock/relock) is
      // a training-state transition that may affect compliance, activity rows,
      // and session status indicators.
      // Key shape verified: DashboardPage.tsx line 105 uses ['dashboard-summary'].
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });

      // If the trainer currently has this plan open in the editor, reload the
      // plan from the server so lock state will be picked up once #384 adds the
      // per-session lock fields to the plan response.  The existing
      // `refreshCompletions()` path re-fetches the whole plan and merges the
      // fresh data without clobbering unsaved trainer edits.
      // We also invalidate ['client-dashboard', clientId] here because the plan
      // is open and we have the clientId in scope.
      const tp = useTrainingPlanStore.getState();
      if (tp.plan && tp.plan.planId === payload.planId) {
        void tp.refreshCompletions();
        // Key shape verified: ClientDetailPage.tsx line 27 uses ['client-dashboard', id].
        queryClient.invalidateQueries({ queryKey: ['client-dashboard', tp.plan.clientId] });
      }
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
      {/* Off-canvas overlay — visible only <md when drawer is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[199] bg-black/45 md:hidden"
          onClick={handleCloseSidebar}
          aria-hidden="true"
        />
      )}
      <Sidebar
        onToggleDark={handleToggleDark}
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
      />
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {/* Hamburger — visible only <md */}
        <div className="flex items-center px-3 py-2 border-b border-border md:hidden">
          <button
            type="button"
            className="flex items-center justify-center w-9 h-9 rounded-md text-text2 hover:bg-bg-hover hover:text-text transition-colors border-none bg-transparent cursor-pointer"
            onClick={() => setSidebarOpen(true)}
            aria-label={t('sidebar.openMenu')}
            aria-expanded={sidebarOpen}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <rect x="2" y="4" width="14" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="2" y="8.25" width="14" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="2" y="12.5" width="14" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </button>
        </div>
        <Suspense fallback={<div className="flex flex-1 items-center justify-center text-text3">Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

export default AppShell;
