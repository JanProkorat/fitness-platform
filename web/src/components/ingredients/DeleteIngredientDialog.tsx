import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteFood } from '@/hooks/useIngredientsQueries';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foodId: string;
  foodName: string;
  onDeleted: () => void;
}

/** Confirmation dialog for soft-deleting a coach-owned ingredient. */
export default function DeleteIngredientDialog({ open, onOpenChange, foodId, foodName, onDeleted }: Props) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteFood();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('ingredients.deleteDialog.title')}</DialogTitle>
          <DialogDescription>{t('ingredients.deleteDialog.description', { name: foodName })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(foodId, { onSuccess: onDeleted })}
          >
            {t('ingredients.deleteDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
