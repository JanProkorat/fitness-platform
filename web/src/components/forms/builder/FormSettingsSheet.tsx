import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { QuestionnaireType } from '@/api/questionnaires';
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type DraftForm,
} from '@/components/forms/builder/form-builder-model';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DraftForm;
  type: QuestionnaireType;
  titleError?: string;
  descriptionError?: string;
  onChange: (patch: Partial<Pick<DraftForm, 'title' | 'description' | 'isDefault'>>) => void;
}

/** Form-level settings. They edit the same draft as the header, so Save covers both. */
export default function FormSettingsSheet({ open, onOpenChange, doc, type, titleError, descriptionError, onChange }: Props) {
  const { t } = useTranslation();
  const isOnboarding = type === QuestionnaireType.Onboarding;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 sm:max-w-md">
        <SheetHeader className="p-6 pr-12">
          <SheetTitle className="text-card-title">{t('forms.builder.settings.title')}</SheetTitle>
          <SheetDescription>{t('forms.builder.settings.description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-6 pb-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="form-settings-title">{t('forms.create.title')}</Label>
            <Input
              id="form-settings-title"
              value={doc.title}
              maxLength={TITLE_MAX_LENGTH}
              aria-invalid={titleError !== undefined}
              onChange={(event) => onChange({ title: event.target.value })}
            />
            {titleError && (
              <p role="alert" className="text-meta text-destructive">
                {t(titleError, { max: TITLE_MAX_LENGTH })}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="form-settings-description">{t('forms.create.description')}</Label>
            <Textarea
              id="form-settings-description"
              value={doc.description}
              rows={4}
              aria-invalid={descriptionError !== undefined}
              placeholder={t('forms.create.descriptionPlaceholder')}
              onChange={(event) => onChange({ description: event.target.value })}
            />
            {descriptionError && (
              <p role="alert" className="text-meta text-destructive">
                {t(descriptionError, { max: DESCRIPTION_MAX_LENGTH })}
              </p>
            )}
          </div>
          {isOnboarding && (
            <div className="flex items-start justify-between gap-4 rounded-field border border-line p-3.5">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="form-settings-default">{t('forms.builder.settings.default')}</Label>
                <p className="text-meta text-muted-foreground">{t('forms.builder.settings.defaultHint')}</p>
              </div>
              <Switch
                id="form-settings-default"
                checked={doc.isDefault}
                onCheckedChange={(isDefault) => onChange({ isDefault })}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
