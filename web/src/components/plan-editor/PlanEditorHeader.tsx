import { useTranslation } from 'react-i18next';
import { Check, Loader2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SaveStatus } from '@/components/plan-editor/plan-editor-types';

const MAX_NAME_LENGTH = 200;

interface SegmentedProps {
  label: string;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  value: string;
}

/** Two-option switch drawn like the board's toggles; options marked disabled do nothing yet. */
function Segmented({ label, options, value }: SegmentedProps) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl bg-muted p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            aria-disabled={option.disabled}
            title={option.disabled ? t('planEditor.comingSoon') : undefined}
            className={cn(
              'h-8 rounded-lg px-4 text-copy font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              active ? 'bg-card text-ink shadow-selection-bar' : 'text-muted-foreground',
              option.disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  breadcrumbLabel: string;
  onBreadcrumb: () => void;
  readOnly: boolean;
  dirty: boolean;
  saveStatus: SaveStatus;
  canUndo: boolean;
  onUndo: () => void;
  onSave: () => void;
}

/** Breadcrumb, editable title, save status, view toggles, undo and Save. */
export default function PlanEditorHeader({
  name,
  onNameChange,
  breadcrumbLabel,
  onBreadcrumb,
  readOnly,
  dirty,
  saveStatus,
  canUndo,
  onUndo,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const nameInvalid = name.trim() === '';
  const saving = saveStatus === 'saving';

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onBreadcrumb}
          className="shrink-0 text-copy text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {breadcrumbLabel}
        </button>
        <span className="text-copy text-muted-foreground" aria-hidden="true">
          /
        </span>
        <h1 className="sr-only">{name}</h1>
        {readOnly ? (
          <span className="min-w-0 truncate font-display text-auth-title font-semibold text-ink" aria-hidden="true">
            {name}
          </span>
        ) : (
          <Input
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(event) => onNameChange(event.target.value)}
            aria-label={t('planEditor.nameLabel')}
            aria-invalid={nameInvalid}
            className="h-10 min-w-0 flex-1 border-transparent bg-transparent px-2 font-display text-auth-title font-semibold text-ink shadow-none hover:border-line"
          />
        )}
        {!readOnly && (
          <span
            role="status"
            data-testid="save-status"
            className="flex shrink-0 items-center gap-1.5 text-body text-muted-foreground"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t('planEditor.status.saving')}
              </>
            ) : dirty ? (
              t('planEditor.status.unsaved')
            ) : (
              <>
                <Check className="size-4" aria-hidden="true" />
                {t('planEditor.status.saved')}
              </>
            )}
          </span>
        )}
      </div>

      <Segmented
        label={t('planEditor.toggles.range')}
        value="week"
        options={[
          { value: 'week', label: t('planEditor.toggles.week') },
          { value: 'day', label: t('planEditor.toggles.day'), disabled: true },
        ]}
      />
      <Segmented
        label={t('planEditor.toggles.view')}
        value="meals"
        options={[
          { value: 'meals', label: t('planEditor.toggles.meals') },
          { value: 'nutrition', label: t('planEditor.toggles.nutrition'), disabled: true },
        ]}
      />
      {!readOnly && (
        <>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            disabled={!canUndo}
            aria-label={t('planEditor.undo')}
            onClick={onUndo}
          >
            <Undo2 aria-hidden="true" />
          </Button>
          <Button type="button" size="lg" className="px-4" disabled={!dirty || nameInvalid || saving} onClick={onSave}>
            <Check aria-hidden="true" />
            {t('planEditor.save')}
          </Button>
        </>
      )}
    </header>
  );
}
