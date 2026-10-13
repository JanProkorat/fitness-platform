import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { QuestionnaireType } from '@/api/questionnaires';
import FormTypeBadge from '@/components/forms/FormTypeBadge';
import { TITLE_MAX_LENGTH } from '@/components/forms/builder/form-builder-model';

interface Props {
  title: string;
  onTitleChange: (title: string) => void;
  titleInvalid: boolean;
  type: QuestionnaireType;
  dirty: boolean;
  saving: boolean;
  onBack: () => void;
  onPreview: () => void;
  onSave: () => void;
}

/** Back, breadcrumb with the editable title, type badge, save status, preview and Save. */
export default function FormBuilderHeader({
  title,
  onTitleChange,
  titleInvalid,
  type,
  dirty,
  saving,
  onBack,
  onPreview,
  onSave,
}: Props) {
  const { t } = useTranslation();

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-6 py-2.5">
      <div className="flex min-w-60 flex-1 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="size-7.5 shrink-0"
          aria-label={t('forms.builder.back')}
          title={t('forms.builder.back')}
          onClick={onBack}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-copy text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('forms.title')}
        </button>
        <span className="text-copy text-muted-foreground" aria-hidden="true">
          /
        </span>
        <h1 className="sr-only">{title}</h1>
        <Input
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(event) => onTitleChange(event.target.value)}
          aria-label={t('forms.builder.titleLabel')}
          aria-invalid={titleInvalid}
          title={title}
          className="h-8 min-w-32 flex-1 truncate border-transparent bg-transparent px-2 font-display text-auth-title font-semibold text-ink shadow-none hover:border-line"
        />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <FormTypeBadge type={type} />
        <span
          role="status"
          data-testid="save-status"
          className="flex shrink-0 items-center gap-1.5 text-body whitespace-nowrap text-muted-foreground"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t('forms.builder.status.saving')}
            </>
          ) : dirty ? (
            t('forms.builder.status.unsaved')
          ) : (
            <>
              <Check className="size-4" aria-hidden="true" />
              {t('forms.builder.status.saved')}
            </>
          )}
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        className="size-7.5"
        aria-label={t('forms.builder.preview.open')}
        title={t('forms.builder.preview.open')}
        onClick={onPreview}
      >
        <Eye className="size-4" aria-hidden="true" />
      </Button>
      <Button type="button" className="h-7.5 px-3" disabled={!dirty || saving} onClick={onSave}>
        <Check aria-hidden="true" />
        {t('forms.builder.save')}
      </Button>
    </header>
  );
}
