import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, X } from 'lucide-react';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { newKey, type StepItem } from '@/components/recipes/recipe-form-types';

interface StepRowProps {
  step: StepItem;
  index: number;
  readOnly: boolean;
  onTextChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}

/** Step text box whose height follows its content, re-measured on text and width changes. */
function AutoGrowTextarea(props: Omit<React.ComponentProps<'textarea'>, 'rows' | 'className' | 'ref'>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fitToContent = useCallback(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useLayoutEffect(fitToContent, [props.value, fitToContent]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    // Re-fit only when the width changes; our own height writes must not re-trigger it.
    let lastWidth = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== lastWidth) {
        lastWidth = element.clientWidth;
        fitToContent();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitToContent]);

  return <Textarea {...props} ref={textareaRef} rows={1} className="min-h-0 flex-1 resize-none overflow-hidden" />;
}

/** One draggable step. Declared at module scope so its sortable state survives parent re-renders. */
function StepRow({ step, index, readOnly, onTextChange, onRemove }: StepRowProps) {
  const { t } = useTranslation();
  const { ref, handleRef, isDragging } = useSortable({ id: step.id, index, disabled: readOnly });

  return (
    <li
      ref={ref}
      className={cn(
        'flex items-start gap-2 rounded-md border border-border bg-card p-3',
        isDragging && 'opacity-60 shadow-selection-bar',
      )}
    >
      {!readOnly && (
        <button
          type="button"
          ref={handleRef}
          className="mt-1 cursor-grab text-muted-foreground"
          aria-label={t('recipes.preparation.reorderStep', { number: index + 1 })}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      )}
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-semibold text-primary-foreground">
        {index + 1}
      </span>
      {readOnly ? (
        <p className="flex-1 pt-0.5 text-body whitespace-pre-wrap break-words text-foreground">{step.text}</p>
      ) : (
        <AutoGrowTextarea
          value={step.text}
          placeholder={t('recipes.preparation.stepPlaceholder')}
          aria-label={t('recipes.preparation.stepLabel', { number: index + 1 })}
          onChange={(event) => onTextChange(step.id, event.target.value)}
        />
      )}
      {!readOnly && (
        <button
          type="button"
          className="mt-1 cursor-pointer text-muted-foreground hover:text-foreground"
          aria-label={t('recipes.preparation.removeStep', { number: index + 1 })}
          onClick={() => onRemove(step.id)}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

interface Props {
  steps: StepItem[];
  onStepsChange: (steps: StepItem[]) => void;
  readOnly: boolean;
  /** Prep/cook time summary shown in the footer line, or null when neither is set. */
  timesSummary: string | null;
}

/**
 * The recipe drawer's Preparation tab: an ordered list of step text boxes,
 * reorderable by dragging, removable, with "+ Add step" appending a new one.
 * Blank steps are dropped on save, not here.
 */
export default function RecipePreparationTab({ steps, onStepsChange, readOnly, timesSummary }: Props) {
  const { t } = useTranslation();

  function updateText(id: string, text: string) {
    onStepsChange(steps.map((step) => (step.id === id ? { ...step, text } : step)));
  }

  function removeStep(id: string) {
    onStepsChange(steps.filter((step) => step.id !== id));
  }

  return (
    <div className="flex min-h-full flex-col gap-3">
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) {
            return;
          }
          onStepsChange(move(steps, event));
        }}
      >
        <ul className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              index={index}
              readOnly={readOnly}
              onTextChange={updateText}
              onRemove={removeStep}
            />
          ))}
        </ul>
      </DragDropProvider>

      {!readOnly && (
        <button
          type="button"
          className="cursor-pointer rounded-md border border-dashed border-border py-2 text-body font-semibold text-primary hover:bg-muted"
          onClick={() => onStepsChange([...steps, { id: newKey(), text: '' }])}
        >
          {t('recipes.preparation.addStep')}
        </button>
      )}

      <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-4 rounded-md bg-muted px-3 py-2 text-meta text-muted-foreground">
        <span>{timesSummary}</span>
        <span>{t('recipes.preparation.hint')}</span>
      </div>
    </div>
  );
}
