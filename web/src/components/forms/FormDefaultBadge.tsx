import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Pill marking the form that is sent automatically when a client joins. */
export default function FormDefaultBadge() {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className="h-6.5 gap-1.5 px-2.5 text-meta font-semibold text-ink">
      <UserPlus className="size-3.5 text-nutrition" aria-hidden="true" />
      {t('forms.defaultBadge')}
    </Badge>
  );
}
