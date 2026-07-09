import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/api/notifications';
import { useApiMutation } from '@/hooks/useApiMutation';

function timeAgo(isoDate: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ['web-notifications'],
    queryFn: () => getNotifications(10),
    refetchInterval: 30_000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markReadMutation = useApiMutation(markNotificationRead, {
    invalidateKeys: [['web-notifications']],
  });

  const markAllReadMutation = useApiMutation(markAllNotificationsRead, {
    invalidateKeys: [['web-notifications']],
  });

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={popoverRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="notif-bell-btn"
        title={t('notifications.title')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-bell-badge">{unreadCount}</span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="notif-popover">
          {/* Header */}
          <div className="notif-popover-header">
            <span className="notif-popover-title">{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button
                className="notif-popover-mark-all"
                onClick={() => markAllReadMutation.mutate()}
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="notif-popover-list">
            {notifications.length === 0 ? (
              <div className="notif-popover-empty">
                {t('notifications.empty')}
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notif-popover-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => {
                    if (!n.read) markReadMutation.mutate(n.id);
                  }}
                >
                  <div className="notif-popover-item-dot-wrap">
                    {!n.read && <div className="notif-popover-item-dot" />}
                  </div>
                  <div className="notif-popover-item-content">
                    <div className="notif-popover-item-title">{n.title}</div>
                    <div className="notif-popover-item-body">{n.body}</div>
                  </div>
                  <div className="notif-popover-item-time">
                    {timeAgo(n.timestamp, t)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="notif-popover-footer">
            {/* No dedicated notifications page exists yet — disable with a
                clear "coming soon" affordance rather than inventing a route
                or leaving a silent no-op (#642). */}
            <button
              className="notif-popover-show-all"
              disabled
              title={t('notifications.showAllComingSoon')}
            >
              {t('notifications.showAll')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
