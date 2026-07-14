import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/api/client';
import type { ClientSummary } from '@/api/client';
import { getPendingInvites, deletePendingInvite, type PendingInviteDto } from '@/api/pending-invites';
import { getIncomingRequests, rejectClientRequest, acceptClientRequest, type IncomingRequest } from '@/api/client-requests';
import { fetchConversations } from '@/api/messages';
import { getTrainerQuestionnaires, type QuestionnaireSummaryDto } from '@/api/questionnaires';
import { cn } from '@/lib/cn';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { NewClientDialog } from '@/components/NewClientDialog';
import { ClientRequestDialog, PendingInviteDialog } from '@/components/layout/SidebarDialogs';
import { PlanCreateDialog, type PlanCreateType } from '@/components/clients/PlanCreateDialog';
import { SidebarPlanSubmenu } from '@/components/clients/SidebarPlanSubmenu';
import { useToastStore } from '@/stores/toast';
import { ImageLightbox } from '@/components/ui';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useMediaQuery, MD_BREAKPOINT_QUERY } from '@/hooks/useMediaQuery';

/** Stable id for the `<aside>` element — referenced by the hamburger
 * trigger's `aria-controls` in AppShell.tsx (#585). */
export const SIDEBAR_ELEMENT_ID = 'app-sidebar';

interface SidebarProps {
  onToggleDark?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ onToggleDark, isOpen = false, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Mobile drawer a11y (#585): move focus into the drawer when it opens and
  // trap Tab cycling while it's open. Focus-restore-to-trigger on close
  // lives in AppShell (which owns the hamburger button ref).
  const asideRef = useRef<HTMLElement>(null);
  useFocusTrap(asideRef, isOpen);
  useEffect(() => {
    if (isOpen) {
      asideRef.current?.focus();
    }
  }, [isOpen]);

  // Below `md` the <aside> is an off-canvas drawer hidden only via a CSS
  // transform when closed (index.css) — its contents stay in the DOM,
  // tab-focusable and screen-reader-visible. `inert` removes an element
  // from both the tab order AND the accessibility tree in one attribute,
  // so it must apply only while closed AND below the `md` breakpoint (the
  // permanent desktop sidebar must never be inert) (#729).
  const isDesktop = useMediaQuery(MD_BREAKPOINT_QUERY);
  const isClosedMobileDrawer = !isDesktop && !isOpen;

  const isNutritionist = user?.roles.some((r) => ['Nutritionist', 'Admin'].includes(r));
  const isTrainer = user?.roles.some((r) => ['Trainer', 'Admin'].includes(r));

  const userInitials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : '??';

  const roleName = user?.roles.map((r) => t(`auth.role${r}`)).join(' & ');

  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  // Tracks the avatarBlobUrl a failure was recorded against. A fresh
  // presigned URL deserves a fresh load attempt — without this, a single
  // transient failure on an old URL permanently pins the avatar to initials
  // even after the URL rotates (#640). Adjusted during render (same pattern
  // as trackedActiveClientId below) rather than in a useEffect, per the
  // React "reset state when a prop changes" guidance.
  const [trackedAvatarUrl, setTrackedAvatarUrl] = useState(user?.avatarBlobUrl ?? null);
  if ((user?.avatarBlobUrl ?? null) !== trackedAvatarUrl) {
    setTrackedAvatarUrl(user?.avatarBlobUrl ?? null);
    setAvatarFailed(false);
  }
  const avatarUrl = !avatarFailed && user?.avatarBlobUrl ? user.avatarBlobUrl : null;

  // Fetch clients
  const { data: clientsData } = useQuery({
    queryKey: ['sidebar-clients'],
    queryFn: () => apiClient.getClientsEndpoint(1, 50),
    staleTime: 60_000,
  });
  const clients: ClientSummary[] = clientsData?.clients ?? [];

  // Fetch pending invites
  const { data: invitesData } = useQuery({
    queryKey: ['pending-invites'],
    queryFn: getPendingInvites,
    staleTime: 30_000,
  });
  const pendingInvites: PendingInviteDto[] = invitesData?.invites ?? [];

  // Fetch incoming client requests
  const { data: requestsData } = useQuery({
    queryKey: ['client-requests'],
    queryFn: getIncomingRequests,
    staleTime: 30_000,
  });
  const incomingRequests: IncomingRequest[] = requestsData ?? [];

  // Fetch unread message count
  const { data: conversationsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
  const convList = Array.isArray(conversationsData) ? conversationsData : [];
  const unreadMessages = convList.reduce((sum, c) => sum + c.unreadCount, 0);

  // Delete invite mutation
  const deleteMutation = useMutation({
    mutationFn: deletePendingInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      setSelectedInvite(null);
    },
  });

  const addToast = useToastStore((s) => s.addToast);

  // Accept client request mutation
  const acceptMutation = useMutation({
    mutationFn: ({ publicId, questionnaireId, statement }: { publicId: string; questionnaireId?: string; statement?: string }) =>
      acceptClientRequest(publicId, questionnaireId || null, statement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-requests'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
      setSelectedRequest(null);
      setStatementText('');
      addToast(t('clientRequests.accepted'), 'success');
    },
  });

  // Reject client request mutation
  const rejectMutation = useMutation({
    mutationFn: ({ publicId, statement }: { publicId: string; statement?: string }) =>
      rejectClientRequest(publicId, statement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-requests'] });
      setSelectedRequest(null);
      setStatementText('');
      addToast(t('clientRequests.rejected'), 'success');
    },
  });

  // State
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  // Which client's plan-type submenu (Jidelnicek / Treninkovy plan) is
  // expanded — independent of `expandedClientId` since a client's whole
  // section and a specific plan-type submenu inside it collapse separately
  // (#780 AC4).
  const [expandedPlanSection, setExpandedPlanSection] = useState<{
    clientId: string;
    type: PlanCreateType;
  } | null>(null);
  const [createPlanDialog, setCreatePlanDialog] = useState<{
    clientId: string;
    type: PlanCreateType;
  } | null>(null);
  const [trackedActiveClientId, setTrackedActiveClientId] = useState<string | null>(null);
  const [selectedInvite, setSelectedInvite] = useState<PendingInviteDto | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<IncomingRequest | null>(null);
  const [statementText, setStatementText] = useState('');
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireSummaryDto[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  // Tracks which incoming request the in-flight getTrainerQuestionnaires()
  // fetch belongs to. If the trainer clicks request B before request A's
  // fetch resolves, A's stale response must not overwrite B's default
  // questionnaire selection (#639).
  const activeRequestIdRef = useRef<string | null>(null);

  const clientMatch = location.pathname.match(/^\/clients\/([^/]+)/);
  const activeClientId = clientMatch?.[1] ?? null;

  // Auto-expand when navigating to a client page (but not collapse when leaving)
  if (activeClientId !== trackedActiveClientId) {
    setTrackedActiveClientId(activeClientId);
    if (activeClientId) {
      setExpandedClientId(activeClientId);
    }
  }

  const toggleClient = (id: string) => {
    setExpandedClientId(prev => prev === id ? null : id);
  };

  const togglePlanSection = (cId: string, type: PlanCreateType) => {
    setExpandedPlanSection((prev) =>
      prev && prev.clientId === cId && prev.type === type ? null : { clientId: cId, type },
    );
  };

  const isPlanSectionExpanded = (cId: string, type: PlanCreateType) =>
    expandedPlanSection?.clientId === cId && expandedPlanSection.type === type;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  // The "Dotazníky" sidebar row navigates into the client-wide questionnaire
  // list tab (DotaznikyTab), which lives at `/clients/:id` behind a `?tab=`
  // query param rather than its own route — so activeness needs the query
  // param, not just the pathname (#777).
  const isDotaznikyActive = (cId: string) =>
    activeClientId === cId && new URLSearchParams(location.search).get('tab') === 'dotazniky';

  // The "Fotky" sidebar row navigates into the client-wide photo-diary tab
  // (FotkyTab), same query-param scheme as Dotazníky above (#778 AC2).
  const isFotkyActive = (cId: string) =>
    activeClientId === cId && new URLSearchParams(location.search).get('tab') === 'fotky';

  return (
    <aside
      ref={asideRef}
      id={SIDEBAR_ELEMENT_ID}
      tabIndex={-1}
      inert={isClosedMobileDrawer}
      className={cn('sb', isOpen && 'sb--open')}
    >
      {/* Workspace header */}
      <div className="sb-ws">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex flex-1 items-center gap-2 cursor-pointer bg-transparent border-0 p-0 m-0 text-left min-w-0"
          aria-label={t('sidebar.dashboard')}
        >
          <div className="sb-ws-icon">GF</div>
          <div className="sb-ws-name">GoodFellas</div>
        </button>
        <NotificationBell />
        {/* Explicit close affordance — mobile drawer only. Wires the
            previously-unused sidebar.closeMenu i18n key (#585). */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('sidebar.closeMenu')}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-md text-text2 hover:bg-bg-hover hover:text-text transition-colors border-none bg-transparent cursor-pointer shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="sb-div" />

      {/* Main navigation */}
      <nav style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
        {/* Dashboard & Messages */}
        <div className="sb-sec shrink-0">
          <NavLink to="/dashboard" className={cn('sb-item', isActive('/dashboard') && 'active')} onClick={onClose}>
            <span className="sbi-icon">📊</span>
            <span className="sbi-lbl">{t('sidebar.dashboard')}</span>
          </NavLink>
          <NavLink to="/profile" className={cn('sb-item', isActive('/profile') && 'active')} onClick={onClose}>
            <span className="sbi-icon">👤</span>
            <span className="sbi-lbl">{t('sidebar.profile')}</span>
          </NavLink>
          <NavLink to="/messages" className={cn('sb-item', isActive('/messages') && 'active')} onClick={onClose}>
            <span className="sbi-icon">💬</span>
            <span className="sbi-lbl">{t('sidebar.messages')}</span>
            {unreadMessages > 0 && <span className="sbi-badge">{unreadMessages}</span>}
          </NavLink>
        </div>

        <div className="sb-div shrink-0" />

        {/* KLIENTI section — scrollable */}
        <div className="sb-sec" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="sb-sec-lbl shrink-0">{t('sidebar.clientsSection')}</div>

          {/* Client search */}
          <div className="shrink-0" style={{ padding: '2px 10px 6px' }}>
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder={t('sidebar.searchClients')}
              style={{
                width: '100%', border: 'none', outline: 'none',
                background: 'var(--bg3)', fontSize: 11, color: 'var(--text)',
                fontFamily: 'inherit', padding: '5px 8px',
                borderRadius: 'var(--radius-md)', transition: 'background 0.1s',
              }}
              onFocus={(e) => { e.target.style.background = 'var(--bg-active)'; }}
              onBlur={(e) => { e.target.style.background = 'var(--bg3)'; }}
            />
          </div>

          {/* Scrollable client list */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

          {clients.filter((c) => {
            if (!clientSearch.trim()) return true;
            const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase();
            return name.includes(clientSearch.toLowerCase());
          }).map((client) => {
            const cId = client.publicId ?? '';
            const isExpanded = expandedClientId === cId;
            const isClientActive = activeClientId === cId;

            return (
              <div key={cId}>
                <div className={cn('sb-item', isClientActive && 'active')} style={{ cursor: 'pointer' }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleClient(cId); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: 10, color: 'var(--text3)', width: 18, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      transition: 'transform 0.15s',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                    aria-label={
                      isExpanded
                        ? t('sidebar.collapseClient', { name: `${client.firstName} ${client.lastName}` })
                        : t('sidebar.expandClient', { name: `${client.firstName} ${client.lastName}` })
                    }
                  >
                    ▶
                  </button>
                  <span
                    role="button"
                    tabIndex={0}
                    className="sbi-lbl"
                    onClick={() => { navigate(`/clients/${cId}`); onClose?.(); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/clients/${cId}`);
                        onClose?.();
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                    aria-label={t('sidebar.goToClient', { name: `${client.firstName} ${client.lastName}` })}
                  >
                    {client.firstName} {client.lastName}
                  </span>
                </div>

                {isExpanded && (
                  <div>
                    {isTrainer && (
                      <div>
                        <div
                          className={cn(
                            'sb-item',
                            (isActive(`/clients/${cId}/training`) || isActive(`/clients/${cId}/training-plans`)) && 'active',
                          )}
                          style={{ paddingLeft: 12 }}
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePlanSection(cId, 'training'); }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                              fontSize: 9, color: 'var(--text3)', width: 14, display: 'flex',
                              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              transition: 'transform 0.15s',
                              transform: isPlanSectionExpanded(cId, 'training') ? 'rotate(90deg)' : 'rotate(0deg)',
                            }}
                            aria-label={
                              isPlanSectionExpanded(cId, 'training')
                                ? t('sidebar.collapseTrainingPlans')
                                : t('sidebar.expandTrainingPlans')
                            }
                          >
                            ▶
                          </button>
                          <span
                            role="button"
                            tabIndex={0}
                            className="sbi-lbl"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                            onClick={() => { navigate(`/clients/${cId}/training`); onClose?.(); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate(`/clients/${cId}/training`);
                                onClose?.();
                              }
                            }}
                          >
                            <span className="sbi-icon">🏋️</span>
                            {t('sidebar.trainingPlan')}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setCreatePlanDialog({ clientId: cId, type: 'training' }); }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 13, color: 'var(--text3)', width: 18, height: 18, display: 'flex',
                              alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 'var(--radius-sm)',
                            }}
                            aria-label={t('sidebar.newTrainingPlanAriaLabel')}
                            title={t('sidebar.newTrainingPlanAriaLabel')}
                          >
                            +
                          </button>
                        </div>
                        {isPlanSectionExpanded(cId, 'training') && (
                          <SidebarPlanSubmenu clientId={cId} planType="training" onNavigate={onClose} />
                        )}
                      </div>
                    )}
                    {isNutritionist && (
                      <div>
                        <div
                          className={cn(
                            'sb-item',
                            (isActive(`/clients/${cId}/nutrition`) || isActive(`/clients/${cId}/plans`)) && 'active',
                          )}
                          style={{ paddingLeft: 12 }}
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePlanSection(cId, 'nutrition'); }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                              fontSize: 9, color: 'var(--text3)', width: 14, display: 'flex',
                              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              transition: 'transform 0.15s',
                              transform: isPlanSectionExpanded(cId, 'nutrition') ? 'rotate(90deg)' : 'rotate(0deg)',
                            }}
                            aria-label={
                              isPlanSectionExpanded(cId, 'nutrition')
                                ? t('sidebar.collapseMealPlans')
                                : t('sidebar.expandMealPlans')
                            }
                          >
                            ▶
                          </button>
                          <span
                            role="button"
                            tabIndex={0}
                            className="sbi-lbl"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                            onClick={() => { navigate(`/clients/${cId}/nutrition`); onClose?.(); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate(`/clients/${cId}/nutrition`);
                                onClose?.();
                              }
                            }}
                          >
                            <span className="sbi-icon">🥗</span>
                            {t('sidebar.mealPlan')}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setCreatePlanDialog({ clientId: cId, type: 'nutrition' }); }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 13, color: 'var(--text3)', width: 18, height: 18, display: 'flex',
                              alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 'var(--radius-sm)',
                            }}
                            aria-label={t('sidebar.newMealPlanAriaLabel')}
                            title={t('sidebar.newMealPlanAriaLabel')}
                          >
                            +
                          </button>
                        </div>
                        {isPlanSectionExpanded(cId, 'nutrition') && (
                          <SidebarPlanSubmenu clientId={cId} planType="nutrition" onNavigate={onClose} />
                        )}
                      </div>
                    )}
                    {/* Dotazníky — navigates into the client-wide questionnaire
                        list tab; no submenu, since it always shows the same
                        list rather than a per-plan-type set (#777). */}
                    <NavLink
                      to={`/clients/${cId}?tab=dotazniky`}
                      className={cn('sb-item', isDotaznikyActive(cId) && 'active')}
                      style={{ paddingLeft: 28 }}
                      onClick={onClose}
                    >
                      <span className="sbi-icon">📝</span>
                      <span className="sbi-lbl">{t('sidebar.questionnaires')}</span>
                    </NavLink>
                    {/* Fotky — navigates into the client-wide photo diary
                        list tab; no submenu, mirrors Dotazníky above (#778). */}
                    <NavLink
                      to={`/clients/${cId}?tab=fotky`}
                      className={cn('sb-item', isFotkyActive(cId) && 'active')}
                      style={{ paddingLeft: 28 }}
                      onClick={onClose}
                    >
                      <span className="sbi-icon">📷</span>
                      <span className="sbi-lbl">{t('sidebar.photos')}</span>
                    </NavLink>
                    <NavLink
                      to={`/clients/${cId}/nutrition-goals`}
                      className={cn('sb-item', isActive(`/clients/${cId}/nutrition-goals`) && 'active')}
                      style={{ paddingLeft: 28 }}
                      onClick={onClose}
                    >
                      <span className="sbi-icon">🎯</span>
                      <span className="sbi-lbl">{t('sidebar.goalsAndMacros')}</span>
                    </NavLink>
                  </div>
                )}
              </div>
            );
          })}

          </div>

          {/* Incoming client requests */}
          {incomingRequests.length > 0 && (
            <div className="shrink-0">
              <div style={{ padding: '6px 14px 2px', fontSize: 10, color: 'var(--red)', letterSpacing: '0.03em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {t('clientRequests.sidebarSection')}
                <span className="text-white" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 16, height: 16, padding: '0 4px',
                  borderRadius: 8, background: 'var(--red)', border: '1px solid var(--red)',
                  fontSize: 10, fontWeight: 600,
                }}>
                  {incomingRequests.length}
                </span>
              </div>
              {incomingRequests.map((req) => (
                <button
                  key={req.publicId}
                  type="button"
                  className="sb-item"
                  onClick={() => {
                    setSelectedRequest(req);
                    setStatementText('');
                    setSelectedQuestionnaireId('');
                    activeRequestIdRef.current = req.publicId;
                    getTrainerQuestionnaires().then((data) => {
                      // Ignore a late resolution if the trainer has since
                      // selected a different request.
                      if (activeRequestIdRef.current !== req.publicId) return;
                      setQuestionnaires(data);
                      const defaultQ = data.find((q) => q.isDefault && q.isActive);
                      setSelectedQuestionnaireId(defaultQ?.publicId ?? '');
                    }).catch(() => {
                      if (activeRequestIdRef.current !== req.publicId) return;
                      setQuestionnaires([]);
                    });
                  }}
                  title={req.message ? `${req.clientFirstName} ${req.clientLastName}: ${req.message}` : `${req.clientFirstName} ${req.clientLastName}`}
                  style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit' }}
                >
                  <span className="sbi-icon" style={{ fontSize: 12 }}>📩</span>
                  <span className="sbi-lbl">{req.clientFirstName} {req.clientLastName}</span>
                </button>
              ))}
            </div>
          )}

          {/* Pending invites — always visible */}
          {pendingInvites.length > 0 && (
            <div className="shrink-0">
              <div style={{ padding: '6px 14px 2px', fontSize: 10, color: 'var(--text4)', letterSpacing: '0.03em' }}>
                {t('sidebar.pendingInvites')}
              </div>
              {pendingInvites.map((invite) => (
                <button
                  key={invite.publicId}
                  type="button"
                  className="sb-item"
                  onClick={() => setSelectedInvite(invite)}
                  style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit', opacity: 0.7 }}
                >
                  <span className="sbi-icon" style={{ opacity: 0.5 }}>✉</span>
                  <span className="sbi-lbl">{invite.firstName} {invite.lastName}</span>
                </button>
              ))}
            </div>
          )}

          {/* Add client — always visible */}
          <button
            type="button"
            className="sb-item shrink-0"
            onClick={() => setNewClientOpen(true)}
            style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit', color: 'var(--text3)' }}
          >
            <span className="sbi-icon" style={{ opacity: 0.5 }}>+</span>
            <span className="sbi-lbl">{t('sidebar.addClient')}</span>
          </button>
        </div>

        {/* DATABÁZE section — pinned to bottom */}
        <div className="sb-div shrink-0" />

        {(isNutritionist || isTrainer) && (
          <div className="sb-sec shrink-0">
            <div className="sb-sec-lbl">{t('sidebar.databaseSection')}</div>

            {isNutritionist && (
              <>
                <NavLink to="/foods" className={cn('sb-item', isActive('/foods') && 'active')} onClick={onClose}>
                  <span className="sbi-icon">📦</span>
                  <span className="sbi-lbl">{t('sidebar.foods')}</span>
                </NavLink>
                <NavLink to="/recipes" className={cn('sb-item', isActive('/recipes') && 'active')} onClick={onClose}>
                  <span className="sbi-icon">📖</span>
                  <span className="sbi-lbl">{t('sidebar.recipes')}</span>
                </NavLink>
              </>
            )}

            {isTrainer && (
              <>
                <NavLink to="/exercises" className={cn('sb-item', isActive('/exercises') && 'active')} onClick={onClose}>
                  <span className="sbi-icon">💪</span>
                  <span className="sbi-lbl">{t('sidebar.exercises')}</span>
                </NavLink>
                <NavLink to="/section-templates" className={cn('sb-item', isActive('/section-templates') && 'active')} onClick={onClose}>
                  <span className="sbi-icon">📋</span>
                  <span className="sbi-lbl">{t('sidebar.sectionTemplates')}</span>
                </NavLink>
              </>
            )}
          </div>
        )}

        <div className="shrink-0" style={{ height: 56 }} />
      </nav>

      {/* Language switcher */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
        <LanguageSwitcher />
      </div>

      {/* User card */}
      <div className="sb-user" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => avatarUrl && setAvatarLightboxOpen(true)}
          disabled={!avatarUrl}
          title={avatarUrl ? t('imageLightbox.open') : undefined}
          aria-label={avatarUrl ? t('imageLightbox.open') : undefined}
          className="sb-avatar"
          style={{
            border: 'none',
            padding: 0,
            cursor: avatarUrl ? 'pointer' : 'default',
            overflow: 'hidden',
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              aria-hidden="true"
              onError={() => setAvatarFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            userInitials
          )}
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.firstName} {user?.lastName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {roleName}
          </div>
        </div>
        {onToggleDark && (
          <button
            type="button"
            onClick={onToggleDark}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text3)', padding: '4px 6px', borderRadius: 'var(--radius)', transition: 'color 0.15s', flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
            title={t('common.toggleDarkMode')}
            aria-label={t('common.toggleDarkMode')}
          >
            ◑
          </button>
        )}
      </div>

      {/* Logout */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={logout}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 16px', border: 'none', borderRadius: 'var(--radius-md)',
            background: 'var(--red-bg)', color: 'var(--red)',
            fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
            cursor: 'pointer', transition: 'background 0.15s, opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t('auth.logout')}
        </button>
      </div>

      {/* Avatar lightbox */}
      <ImageLightbox
        images={avatarUrl ? [avatarUrl] : []}
        open={avatarLightboxOpen}
        onClose={() => setAvatarLightboxOpen(false)}
        altPrefix={user ? `${user.firstName} ${user.lastName}` : undefined}
      />

      {/* New client dialog */}
      <NewClientDialog open={newClientOpen} onClose={() => setNewClientOpen(false)} />

      {/* Create-plan dialog — opened via the "+" button next to Jidelnicek /
          Treninkovy plan in the client tree (#780 AC2). */}
      <PlanCreateDialog
        open={!!createPlanDialog}
        onClose={() => setCreatePlanDialog(null)}
        clientId={createPlanDialog?.clientId ?? ''}
        planType={createPlanDialog?.type ?? 'nutrition'}
        onCreated={(planId) => {
          const dialogState = createPlanDialog;
          setCreatePlanDialog(null);
          onClose?.();
          if (!dialogState) return;
          navigate(
            dialogState.type === 'nutrition'
              ? `/clients/${dialogState.clientId}/plans/${planId}`
              : `/clients/${dialogState.clientId}/training-plans/${planId}`,
          );
        }}
      />

      {/* Client request detail dialog */}
      <ClientRequestDialog
        isOpen={!!selectedRequest}
        request={selectedRequest}
        statementText={statementText}
        onStatementChange={setStatementText}
        selectedQuestionnaireId={selectedQuestionnaireId}
        onQuestionnaireChange={setSelectedQuestionnaireId}
        questionnaires={questionnaires}
        onAccept={() => acceptMutation.mutate({
          publicId: selectedRequest?.publicId ?? '',
          questionnaireId: selectedQuestionnaireId || undefined,
          statement: statementText || undefined,
        })}
        onReject={() => rejectMutation.mutate({ publicId: selectedRequest?.publicId ?? '', statement: statementText || undefined })}
        acceptPending={acceptMutation.isPending}
        rejectPending={rejectMutation.isPending}
        onClose={() => setSelectedRequest(null)}
      />

      {/* Pending invite detail dialog */}
      <PendingInviteDialog
        isOpen={!!selectedInvite}
        invite={selectedInvite}
        deletePending={deleteMutation.isPending}
        onDelete={() => deleteMutation.mutate(selectedInvite?.publicId ?? '')}
        onClose={() => setSelectedInvite(null)}
      />
    </aside>
  );
}

export default Sidebar;
