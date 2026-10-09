import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ExternalLink, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ParticipantAvatar from '@/components/inbox/ParticipantAvatar';
import type { ParticipantDto } from '@/api/generated';

interface Props {
  participant: ParticipantDto;
  showClientPanel: boolean;
  onToggleClientPanel: () => void;
  isFormer?: boolean;
}

/**
 * Thread header: avatar + name, a "Show client" / "Hide client" toggle for
 * the right-hand panel, a disabled gear (no settings surface exists), and
 * an external-link icon to `/clients/:clientId` when the participant
 * carries a `clientPublicId` (always true for a trainer/nutritionist
 * caller's conversations — messaging has no professional-to-professional
 * thread shape).
 */
export default function ThreadHeader({ participant, showClientPanel, onToggleClientPanel, isFormer = false }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <ParticipantAvatar
          name={participant.name}
          initials={participant.initials}
          avatarBlobUrl={participant.avatarBlobUrl}
          className="size-8.5 shrink-0"
        />
        <span className="truncate text-subhead font-semibold text-ink">{participant.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          className="h-8.5 gap-1.75 rounded-field bg-card px-3.5 text-body font-semibold text-ink"
          onClick={onToggleClientPanel}
        >
          <User className="size-4" aria-hidden="true" />
          {showClientPanel ? t('inbox.thread.hideClient') : t('inbox.thread.showClient')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8.5 rounded-field text-muted-foreground"
          disabled
          title={t('shell.comingSoon')}
          aria-label={t('inbox.thread.settingsAriaLabel')}
        >
          <Settings className="size-4" aria-hidden="true" />
        </Button>
        {participant.clientPublicId && !isFormer ? (
          <Button type="button" variant="ghost" size="icon-sm" className="size-8.5 rounded-field text-ink-2" asChild>
            <Link to={`/clients/${participant.clientPublicId}`} aria-label={t('inbox.thread.openClientProfileAriaLabel')}>
              <ExternalLink className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8.5 rounded-field text-muted-foreground"
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
