import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeletePlanTemplate } from '@/hooks/usePlanTemplatesQueries';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
}

/** Confirmation dialog for deleting an owned plan template. */
export default function DeletePlanTemplateDialog({ open, onOpenChange, templateId, templateName }: Props) {
  const { t } = useTranslation();
  const deleteMutation = useDeletePlanTemplate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('planTemplates.deleteDialog.title')}</DialogTitle>
          <DialogDescription>{t('planTemplates.deleteDialog.description', { name: templateName })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(templateId, { onSettled: () => onOpenChange(false) })}
          >
            {t('planTemplates.deleteDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
