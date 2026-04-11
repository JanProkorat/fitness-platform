import { useState, useEffect } from 'react';
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
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/toast';

interface SidebarProps {
  onToggleDark?: () => void;
}

export function Sidebar({ onToggleDark }: SidebarProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isNutritionist = user?.roles.some((r) => ['Nutritionist', 'Admin'].includes(r));
  const isTrainer = user?.roles.some((r) => ['Trainer', 'Admin'].includes(r));

  const userInitials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : '??';

  const roleName = user?.roles.map((r) => t(`auth.role${r}`)).join(' & ');

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
  const [selectedInvite, setSelectedInvite] = useState<PendingInviteDto | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<IncomingRequest | null>(null);
  const [statementText, setStatementText] = useState('');
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireSummaryDto[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');

  const clientMatch = location.pathname.match(/^\/clients\/([^/]+)/);
  const activeClientId = clientMatch?.[1] ?? null;

  // Auto-expand when navigating to a client page (but not collapse when leaving)
  useEffect(() => {
    if (activeClientId) {
      setExpandedClientId(activeClientId);
    }
  }, [activeClientId]);

  const toggleClient = (id: string) => {
    setExpandedClientId(prev => prev === id ? null : id);
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <aside className="sb">
      {/* Workspace header */}
      <div className="sb-ws">
        <div className="sb-ws-icon">GF</div>
        <div className="sb-ws-name">GoodFellas</div>
        <NotificationBell />
      </div>

      <div className="sb-div" />

      {/* Main navigation */}
      <nav style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
        {/* Dashboard & Messages */}
        <div className="sb-sec shrink-0">
          <NavLink to="/dashboard" className={cn('sb-item', isActive('/dashboard') && 'active')}>
            <span className="sbi-icon">📊</span>
            <span className="sbi-lbl">{t('sidebar.dashboard')}</span>
          </NavLink>
          <NavLink to="/profile" className={cn('sb-item', isActive('/profile') && 'active')}>
            <span className="sbi-icon">👤</span>
            <span className="sbi-lbl">{t('sidebar.profile')}</span>
          </NavLink>
          <NavLink to="/messages" className={cn('sb-item', isActive('/messages') && 'active')}>
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
                  >
                    ▶
                  </button>
                  <span
                    className="sbi-lbl"
                    onClick={() => navigate(`/clients/${cId}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {client.firstName} {client.lastName}
                  </span>
                </div>

                {isExpanded && (
                  <div>
                    {isTrainer && (
                      <NavLink
                        to={`/clients/${cId}/training`}
                        className={cn('sb-item', (isActive(`/clients/${cId}/training`) || isActive(`/clients/${cId}/training-plans`)) && 'active')}
                        style={{ paddingLeft: 28 }}
                      >
                        <span className="sbi-icon">🏋️</span>
                        <span className="sbi-lbl">{t('sidebar.trainingPlan')}</span>
                      </NavLink>
                    )}
                    {isNutritionist && (
                      <NavLink
                        to={`/clients/${cId}/nutrition`}
                        className={cn('sb-item', (isActive(`/clients/${cId}/nutrition`) || isActive(`/clients/${cId}/plans`)) && 'active')}
                        style={{ paddingLeft: 28 }}
                      >
                        <span className="sbi-icon">🥗</span>
                        <span className="sbi-lbl">{t('sidebar.mealPlan')}</span>
                      </NavLink>
                    )}
                    <NavLink
                      to={`/clients/${cId}/nutrition-goals`}
                      className={cn('sb-item', isActive(`/clients/${cId}/nutrition-goals`) && 'active')}
                      style={{ paddingLeft: 28 }}
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
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 16, height: 16, padding: '0 4px',
                  borderRadius: 8, background: 'var(--red)', border: '1px solid var(--red)',
                  fontSize: 10, fontWeight: 600, color: '#fff',
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
                    getTrainerQuestionnaires().then((data) => {
                      setQuestionnaires(data);
                      const defaultQ = data.find((q) => q.isDefault && q.isActive);
                      setSelectedQuestionnaireId(defaultQ?.publicId ?? '');
                    }).catch(() => setQuestionnaires([]));
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
                <NavLink to="/foods" className={cn('sb-item', isActive('/foods') && 'active')}>
                  <span className="sbi-icon">📦</span>
                  <span className="sbi-lbl">{t('sidebar.foods')}</span>
                </NavLink>
                <NavLink to="/recipes" className={cn('sb-item', isActive('/recipes') && 'active')}>
                  <span className="sbi-icon">📖</span>
                  <span className="sbi-lbl">{t('sidebar.recipes')}</span>
                </NavLink>
              </>
            )}

            {isTrainer && (
              <NavLink to="/exercises" className={cn('sb-item', isActive('/exercises') && 'active')}>
                <span className="sbi-icon">💪</span>
                <span className="sbi-lbl">{t('sidebar.exercises')}</span>
              </NavLink>
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
        <div className="sb-avatar">{userInitials}</div>
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
            title="Toggle dark mode"
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

      {/* New client dialog */}
      <NewClientDialog open={newClientOpen} onClose={() => setNewClientOpen(false)} />

      {/* Client request detail dialog */}
      {selectedRequest && (
        <Dialog
          open={true}
          onClose={() => setSelectedRequest(null)}
          title={t('clientRequests.title')}
          maxWidth={420}
          footer={
            <>
              <Button
                variant="danger"
                onClick={() => rejectMutation.mutate({ publicId: selectedRequest.publicId, statement: statementText || undefined })}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? t('common.loading') : t('clientRequests.reject')}
              </Button>
              <Button
                variant="primary"
                onClick={() => acceptMutation.mutate({
                  publicId: selectedRequest.publicId,
                  questionnaireId: selectedQuestionnaireId || undefined,
                  statement: statementText || undefined,
                })}
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? t('common.saving') : t('clientRequests.accept')}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
                {t('common.name')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
                {selectedRequest.clientFirstName} {selectedRequest.clientLastName}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
                Email
              </div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>
                {selectedRequest.clientEmail}
              </div>
            </div>
            {selectedRequest.message && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
                  {t('clientRequests.message')}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text)' }}>
                  {selectedRequest.message}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
                {t('clientRequests.sentAt')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>
                {new Date(selectedRequest.sentAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Questionnaire selector */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
                {t('clientRequests.selectQuestionnaire')}
              </div>
              <select
                value={selectedQuestionnaireId}
                onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg3)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              >
                <option value="">{t('clientRequests.noQuestionnaire')}</option>
                {questionnaires.filter((q) => q.isActive).map((q) => (
                  <option key={q.publicId} value={q.publicId}>
                    {q.title}{q.isDefault ? ` (${t('questionnaire.default')})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Statement */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
                {t('clientRequests.statement')}
              </div>
              <textarea
                value={statementText}
                onChange={(e) => setStatementText(e.target.value)}
                placeholder={t('clientRequests.statementPlaceholder')}
                maxLength={1000}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg3)',
                  color: 'var(--text)',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </Dialog>
      )}

      {/* Pending invite detail dialog */}
      {selectedInvite && (
        <Dialog
          open={true}
          onClose={() => setSelectedInvite(null)}
          title="Čekající pozvánka"
          maxWidth={400}
          footer={
            <>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate(selectedInvite.publicId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Mazání...' : 'Smazat pozvánku'}
              </Button>
              <Button onClick={() => setSelectedInvite(null)}>Zavřít</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>Jméno</div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>{selectedInvite.firstName} {selectedInvite.lastName}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>Email</div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>{selectedInvite.email}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>Pozvánka odeslána</div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>
                {new Date(selectedInvite.sentAt).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--accent-bg)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text2)' }}>
              Klient zatím nepřijal pozvánku. Pokud ji chcete zrušit, klikněte na „Smazat pozvánku".
            </div>
          </div>
        </Dialog>
      )}
    </aside>
  );
}

export default Sidebar;
