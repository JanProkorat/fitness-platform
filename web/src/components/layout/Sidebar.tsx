import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/api/client';
import type { ClientSummary } from '@/api/client';
import { getPendingInvites, deletePendingInvite, type PendingInviteDto } from '@/api/pending-invites';
import { cn } from '@/lib/cn';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { NewClientDialog } from '@/components/NewClientDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

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

  // Delete invite mutation
  const deleteMutation = useMutation({
    mutationFn: deletePendingInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      setSelectedInvite(null);
    },
  });

  // State
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [selectedInvite, setSelectedInvite] = useState<PendingInviteDto | null>(null);

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
        {onToggleDark && (
          <button
            type="button"
            onClick={onToggleDark}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text3)', padding: '2px 4px', borderRadius: 'var(--radius)', transition: 'background 0.1s' }}
            title="Tmavý režim"
          >
            ◑
          </button>
        )}
      </div>

      <div className="sb-div" />

      {/* Main navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
        {/* Dashboard & Messages */}
        <div className="sb-sec">
          <NavLink to="/dashboard" className={cn('sb-item', isActive('/dashboard') && 'active')}>
            <span className="sbi-icon">⊞</span>
            <span className="sbi-lbl">{t('sidebar.dashboard')}</span>
          </NavLink>
          <NavLink to="/messages" className={cn('sb-item', isActive('/messages') && 'active')}>
            <span className="sbi-icon">✉</span>
            <span className="sbi-lbl">{t('sidebar.messages')}</span>
            <span className="sbi-badge">1</span>
          </NavLink>
        </div>

        <div className="sb-div" />

        {/* KLIENTI section */}
        <div className="sb-sec">
          <div className="sb-sec-lbl">{t('sidebar.clientsSection')}</div>

          {clients.map((client) => {
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
                        to={`/training-plans`}
                        className={cn('sb-item', isActive(`/training-plans`) && 'active')}
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

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <>
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
            </>
          )}

          {/* Add client */}
          <button
            type="button"
            className="sb-item"
            onClick={() => setNewClientOpen(true)}
            style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit', color: 'var(--text3)' }}
          >
            <span className="sbi-icon" style={{ opacity: 0.5 }}>+</span>
            <span className="sbi-lbl">{t('sidebar.addClient')}</span>
          </button>
        </div>

        <div className="sb-div" />

        {/* DATABÁZE section */}
        {(isNutritionist || isTrainer) && (
          <div className="sb-sec">
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
