import { useTranslation } from 'react-i18next';
import { Smile, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isChoiceKind, QuestionKind, type DraftForm, type DraftQuestion } from '@/components/forms/builder/form-builder-model';

const FACES = [1, 2, 3, 4, 5];

function PreviewAnswer({ question }: { question: DraftQuestion }) {
  const { t } = useTranslation();
  if (isChoiceKind(question.type)) {
    const radio = question.type === QuestionKind.SingleChoice;
    return (
      <ul className="flex flex-col gap-2">
        {[...question.options, ...(question.allowOther ? [t('forms.builder.choice.other')] : [])].map((option, index) => (
          <li key={index}>
            <label className="flex items-center gap-2.5 text-copy text-ink">
              <input type={radio ? 'radio' : 'checkbox'} name={question.key} className="size-4" tabIndex={-1} />
              {option}
            </label>
          </li>
        ))}
      </ul>
    );
  }
  if (question.type === QuestionKind.Number) {
    return (
      <div className="flex items-center gap-2">
        <Input inputMode="decimal" className="w-40" tabIndex={-1} aria-label={question.label} />
        {question.unit && <span className="text-copy text-muted-foreground">{question.unit}</span>}
      </div>
    );
  }
  if (question.type === QuestionKind.ShortText) {
    return <Textarea rows={2} tabIndex={-1} aria-label={question.label} placeholder={t('forms.builder.text.placeholder')} />;
  }
  if (question.type === QuestionKind.SmileyRating) {
    return (
      <div className="flex gap-3">
        {FACES.map((face) => (
          <div key={face} className="flex w-16 flex-col items-center gap-1">
            <span className="flex size-10 items-center justify-center rounded-full border border-line text-ink">
              <Smile className="size-5" aria-hidden="true" />
            </span>
            <span className="text-meta text-muted-foreground">
              {face === 1 ? question.lowLabel : face === FACES.length ? question.highLabel : ''}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (question.type === QuestionKind.StarRating) {
    return (
      <div className="flex gap-1.5 text-muted-foreground">
        {FACES.map((star) => (
          <Star key={star} className="size-6" aria-hidden="true" />
        ))}
      </div>
    );
  }
  return <p className="text-body text-muted-foreground">{t('forms.builder.preview.unsupported')}</p>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DraftForm;
}

/** Read-only view of the current, unsaved draft as a client would see it. Inputs are inert. */
export default function FormPreviewDialog({ open, onOpenChange, doc }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{doc.title || t('forms.builder.preview.untitled')}</DialogTitle>
          <DialogDescription>{doc.description || t('forms.builder.preview.hint')}</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-6" inert data-testid="form-preview">
          {doc.questions.map((question, index) => (
            <li key={question.key} className="flex flex-col gap-2">
              <p className="text-copy font-semibold text-ink">
                {index + 1}. {question.label}
                {question.isRequired && <span className="text-destructive"> *</span>}
              </p>
              {question.helperText && <p className="text-body text-muted-foreground">{question.helperText}</p>}
              <PreviewAnswer question={question} />
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
