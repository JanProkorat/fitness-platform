import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

/** Pill marking the form that is sent automatically when a client joins; hover or focus explains it. */
export default function FormDefaultBadge() {
  const { t } = useTranslation();
  const hint = t('forms.builder.info.onboarding');
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <span tabIndex={0} title={hint} className="inline-flex rounded-full">
          <Badge variant="outline" className="h-6.5 gap-1.5 px-2.5 text-meta font-semibold text-ink">
            <UserPlus className="size-3.5 text-nutrition" aria-hidden="true" />
            {t('forms.defaultBadge')}
          </Badge>
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-60 text-meta text-ink">{hint}</HoverCardContent>
    </HoverCard>
  );
}
