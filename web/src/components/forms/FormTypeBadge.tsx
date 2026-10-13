import { useTranslation } from 'react-i18next';
import { CheckSquare, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { QuestionnaireType } from '@/api/questionnaires';
import { cn } from '@/lib/utils';

interface Props {
  type: QuestionnaireType;
}

/** Pill naming a form's type; the icon colour tells onboarding (green) from check-in (red) at a glance. */
export default function FormTypeBadge({ type }: Props) {
  const { t } = useTranslation();
  const isOnboarding = type === QuestionnaireType.Onboarding;
  const Icon = isOnboarding ? UserPlus : CheckSquare;
  return (
    <Badge variant="outline" className="h-6.5 gap-1.5 px-2.5 text-meta font-semibold text-ink">
      <Icon className={cn('size-3.5', isOnboarding ? 'text-nutrition' : 'text-marker-text')} aria-hidden="true" />
      {t(`forms.type.${type}`)}
    </Badge>
  );
}
