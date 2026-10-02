import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type VisibilityValue = 'Private' | 'Public';

const OPTIONS: VisibilityValue[] = ['Private', 'Public'];

interface Props {
  value: VisibilityValue;
  onChange: (value: VisibilityValue) => void;
  /** Picks the hint wording ("this recipe" / "this ingredient"). */
  entity: 'recipe' | 'ingredient';
  id: string;
}

/**
 * Two-option segmented control (Private | Public) for a library item's
 * visibility, built on a radio group so arrow keys and screen readers work.
 */
export default function VisibilityToggle({ value, onChange, entity, id }: Props) {
  const { t } = useTranslation();
  const hintId = useId();
  const labelId = `${id}-label`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label id={labelId}>
        {t('library.visibility.label')}
      </Label>
      <RadioGroupPrimitive.Root
        id={id}
        value={value}
        onValueChange={(next) => onChange(next as VisibilityValue)}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        orientation="horizontal"
        data-testid={`${entity}-visibility`}
        className="inline-flex w-fit gap-1 rounded-md border border-input bg-muted p-1"
      >
        {OPTIONS.map((option) => (
          <RadioGroupPrimitive.Item
            key={option}
            value={option}
            data-testid={`${entity}-visibility-${option.toLowerCase()}`}
            className={cn(
              'h-8 min-w-24 rounded-sm px-3 text-body font-medium text-muted-foreground outline-none transition-colors',
              'focus-visible:ring-3 focus-visible:ring-ring/50',
              'data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-sm',
            )}
          >
            {t(`library.visibility.options.${option}`)}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
      <p id={hintId} className="text-meta text-muted-foreground">
        {t(`library.visibility.hint.${value}.${entity}`)}
      </p>
    </div>
  );
}
