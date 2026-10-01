import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteRecipe } from '@/hooks/useRecipesQueries';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  recipeName: string;
  onDeleted: () => void;
}

/** Confirmation dialog for deleting a coach-owned recipe. */
export default function DeleteRecipeDialog({ open, onOpenChange, recipeId, recipeName, onDeleted }: Props) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteRecipe();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('recipes.deleteDialog.title')}</DialogTitle>
          <DialogDescription>{t('recipes.deleteDialog.description', { name: recipeName })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(recipeId, { onSuccess: onDeleted })}
          >
            {t('recipes.deleteDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
