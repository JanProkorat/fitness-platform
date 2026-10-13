import { useTranslation } from 'react-i18next';
import { QuestionnaireType } from '@/api/questionnaires';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS = [QuestionnaireType.Onboarding, QuestionnaireType.CheckIn] as const;

interface Props {
  value: QuestionnaireType;
  onChange: (type: QuestionnaireType) => void;
  /** Id of the element that labels the group. */
  labelledBy: string;
  /** Layout of the option grid; the dialog uses two columns, the narrow side panel one. */
  className?: string;
}

/** Radio group with the two form types and a one-line hint under each. */
export default function FormTypePicker({ value, onChange, labelledBy, className }: Props) {
  const { t } = useTranslation();

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={cn('grid grid-cols-2 gap-2', className)}>
      {TYPE_OPTIONS.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded-field border px-3.5 py-2.5 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              selected ? 'border-ink bg-sunken' : 'border-line bg-card hover:bg-muted',
            )}
          >
            <span className="text-body font-semibold text-ink">{t(`forms.type.${option}`)}</span>
            <span className="text-meta text-muted-foreground">{t(`forms.create.typeHint.${option}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
