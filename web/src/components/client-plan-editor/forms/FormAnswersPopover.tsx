import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';
import type { ClientFormItem } from '@/api/questionnaires';
import ClientFormAnswers from '@/components/client-forms/ClientFormAnswers';
import { KindChip } from '@/components/client-plan-editor/forms/FormCard';
import { formatFormDate } from '@/components/client-plan-editor/forms/planEditorForms';
import { Button } from '@/components/ui/button';

/** Gap between the side panel's right edge and the popover. */
const PANEL_GAP_PX = 12;
/** How far below the top of the editor the popover starts, clearing the header row. */
const TOP_OFFSET_PX = 64;
/** Space kept free below the popover. */
const BOTTOM_MARGIN_PX = 24;

interface Position {
  left: number;
  top: number;
}

interface Props {
  item: ClientFormItem;
  clientId: string;
  clientFirstName: string;
  /** Any element inside the side panel; the popover anchors to the panel's right edge. */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/**
 * The answers of one form, beside the side panel and over the plan grid. It is not modal: no focus trap, no page
 * lock, and it ignores outside clicks, so meals can still be dragged. It is rendered in a portal because the
 * panel clips its children, and tagged `data-plan-library` so the grid's outside-click check leaves it alone.
 */
export default function FormAnswersPopover({ item, clientId, clientFirstName, anchorRef, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    const panel = anchorRef.current?.closest('[data-plan-library]');
    if (!panel) {
      return;
    }
    const measure = () => {
      const rect = panel.getBoundingClientRect();
      setPosition({ left: rect.right + PANEL_GAP_PX, top: rect.top + TOP_OFFSET_PX });
    };
    measure();
    // The panel animates its width when it opens or collapses, and the window can resize.
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [anchorRef]);

  // Move focus in on open and give it back to the card on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  if (!position) {
    return null;
  }

  const profileBase = `/clients/${clientId}/forms`;
  const answers = item.answers ?? [];

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-plan-library
      data-testid="form-answers-popover"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      style={{
        left: position.left,
        top: position.top,
        maxHeight: `calc(100vh - ${position.top + BOTTOM_MARGIN_PX}px)`,
      }}
      className="fixed z-40 flex w-105 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-popover outline-none"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-6 pt-5 pb-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="flex">
            <KindChip kind={item.kind} />
          </span>
          <h2 id={titleId} className="text-title font-bold text-ink [overflow-wrap:anywhere]">
            {item.questionnaireTitle}
          </h2>
          <p className="text-body text-muted-foreground">
            {t('clientForms.popover.meta', {
              name: clientFirstName,
              date: formatFormDate(item.submittedAt, i18n.language),
              count: answers.length,
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          aria-label={t('common.close')}
          title={t('common.close')}
          data-testid="form-answers-close"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ClientFormAnswers answers={answers} />
      </div>

      <div className="shrink-0 border-t border-line px-6 py-3.5">
        <Link
          to={`${profileBase}?form=${encodeURIComponent(item.responsePublicId ?? '')}`}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="form-open-in-profile"
          className="inline-flex items-center gap-1.5 rounded-xs text-body font-semibold text-ink underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('clientForms.popover.openInProfile', { name: clientFirstName })}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>,
    document.body,
  );
}
