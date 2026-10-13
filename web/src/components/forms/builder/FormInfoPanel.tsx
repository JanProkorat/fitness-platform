import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { QuestionnaireType } from '@/api/questionnaires';
import FormTypePicker from '@/components/forms/FormTypePicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type DraftForm,
} from '@/components/forms/builder/form-builder-model';

const SECTION_LABEL_CLASS = 'text-label font-semibold tracking-label text-ink-2 uppercase';

interface Props {
  doc: DraftForm;
  titleError?: string;
  descriptionError?: string;
  onChange: (patch: Partial<Pick<DraftForm, 'title' | 'description' | 'type' | 'isDefault'>>) => void;
}

/** Side-panel tab with the form's own data. It edits the same draft as the header title, so Save covers both. */
export default function FormInfoPanel({ doc, titleError, descriptionError, onChange }: Props) {
  const { t } = useTranslation();
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const typeId = `${baseId}-type`;
  const defaultId = `${baseId}-default`;

  return (
    <div data-testid="form-info" className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4.5">
        <div className="flex flex-col gap-1">
          <Label htmlFor={titleId}>
            {t('forms.create.title')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id={titleId}
            value={doc.title}
            maxLength={TITLE_MAX_LENGTH}
            aria-invalid={titleError !== undefined}
            aria-describedby={titleError ? `${titleId}-error` : undefined}
            onChange={(event) => onChange({ title: event.target.value })}
            className="h-10"
          />
          {titleError && (
            <p id={`${titleId}-error`} role="alert" className="text-meta text-destructive">
              {t(titleError, { max: TITLE_MAX_LENGTH })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor={descriptionId}>{t('forms.create.description')}</Label>
          <Textarea
            id={descriptionId}
            value={doc.description}
            aria-invalid={descriptionError !== undefined}
            aria-describedby={descriptionError ? `${descriptionId}-error` : undefined}
            placeholder={t('forms.create.descriptionPlaceholder')}
            onChange={(event) => onChange({ description: event.target.value })}
            className="field-sizing-content min-h-24 max-h-60 overflow-y-auto"
          />
          {descriptionError && (
            <p id={`${descriptionId}-error`} role="alert" className="text-meta text-destructive">
              {t(descriptionError, { max: DESCRIPTION_MAX_LENGTH })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span id={typeId} className={SECTION_LABEL_CLASS}>
            {t('forms.create.type')}
          </span>
          <FormTypePicker
            value={doc.type}
            onChange={(type) => onChange({ type })}
            labelledBy={typeId}
            className="grid-cols-1"
          />
        </div>

        {doc.type === QuestionnaireType.Onboarding && (
          <div className="flex items-start justify-between gap-4 rounded-field border border-line p-3.5">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={defaultId}>{t('forms.builder.settings.default')}</Label>
              <p className="text-meta text-muted-foreground">{t('forms.builder.settings.defaultHint')}</p>
            </div>
            <Switch id={defaultId} checked={doc.isDefault} onCheckedChange={(isDefault) => onChange({ isDefault })} />
          </div>
        )}
      </div>
    </div>
  );
}
