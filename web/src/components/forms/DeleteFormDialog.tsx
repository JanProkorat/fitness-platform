import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteForm } from '@/hooks/useQuestionnaireQueries';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formName: string;
}

/** Confirmation dialog for deleting a form. */
export default function DeleteFormDialog({ open, onOpenChange, formId, formName }: Props) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteForm();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('forms.deleteDialog.title')}</DialogTitle>
          <DialogDescription>{t('forms.deleteDialog.description', { name: formName })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(formId, { onSettled: () => onOpenChange(false) })}
          >
            {t('forms.deleteDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
