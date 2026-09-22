import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ExternalLink, Settings, User, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ParticipantAvatar from '@/components/inbox/ParticipantAvatar';
import type { ParticipantDto } from '@/api/generated';

interface Props {
  participant: ParticipantDto;
  showClientPanel: boolean;
  onToggleClientPanel: () => void;
}

/**
 * Thread header: avatar + name, a "Show client" / "Hide client" toggle for
 * the right-hand panel, a disabled gear (no settings surface exists), and
 * an external-link icon to `/clients/:clientId` when the participant
 * carries a `clientPublicId` (always true for a trainer/nutritionist
 * caller's conversations — messaging has no professional-to-professional
 * thread shape).
 */
export default function ThreadHeader({ participant, showClientPanel, onToggleClientPanel }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border p-4">
      <div className="flex items-center gap-2">
        <ParticipantAvatar
          name={participant.name}
          initials={participant.initials}
          avatarBlobUrl={participant.avatarBlobUrl}
          className="size-8"
        />
        <span className="text-body font-bold text-ink">{participant.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onToggleClientPanel}>
          {showClientPanel ? (
            <UserX className="size-4" aria-hidden="true" />
          ) : (
            <User className="size-4" aria-hidden="true" />
          )}
          {showClientPanel ? t('inbox.thread.hideClient') : t('inbox.thread.showClient')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled
          title={t('shell.comingSoon')}
          aria-label={t('inbox.thread.settingsAriaLabel')}
        >
          <Settings className="size-4" aria-hidden="true" />
        </Button>
        {participant.clientPublicId ? (
          <Button type="button" variant="ghost" size="icon-sm" asChild>
            <Link to={`/clients/${participant.clientPublicId}`} aria-label={t('inbox.thread.openClientProfileAriaLabel')}>
              <ExternalLink className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled
            aria-label={t('inbox.thread.openClientProfileAriaLabel')}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
