import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Tag as TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateFoodTag, useFoodTags } from '@/hooks/useIngredientsQueries';
import TagFormDialog, { type TagFormValues } from '@/components/tags/TagFormDialog';
import type { FoodTagDto } from '@/api/food-types';

interface Props {
  /** The caller's tags currently assigned to the item being edited. */
  assignedTags: FoodTagDto[];
  /** Called with the full desired tag set; the parent owns the replace-assignments call. */
  onReplace: (tagIds: string[]) => void;
  /** True while the parent's replace call is in flight. */
  isReplacing: boolean;
}

/**
 * Per-item tag assignment shared by the Ingredients and Recipes drawers (the
 * caller's tag list is one list for both). Built on Popover (not DropdownMenu)
 * so multi-select doesn't fight Radix's close-on-select default, always sends
 * the *full* desired tag set so a stale double-click can't partially apply,
 * and offers an inline "+ Create tag" entry point that auto-assigns the new
 * tag to the item once created.
 *
 * The popover is controlled (`open`) and closes itself before opening
 * `TagFormDialog`, same as `LibraryTagFilterPopover`.
 */
export default function LibraryTagPickerPopover({ assignedTags, onReplace, isReplacing }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tagsQuery = useFoodTags();
  const createMutation = useCreateFoodTag();
  const tags = tagsQuery.data ?? [];
  const assignedIds = new Set(assignedTags.map((tag) => tag.tagId).filter((id): id is string => Boolean(id)));

  function toggleTag(tagId: string) {
    onReplace(assignedIds.has(tagId) ? [...assignedIds].filter((id) => id !== tagId) : [...assignedIds, tagId]);
  }

  function handleCreateClick() {
    setOpen(false);
    setCreateOpen(true);
  }

  function handleCreateDialogCloseAutoFocus(event: Event) {
    event.preventDefault();
    triggerRef.current?.focus();
  }

  function handleCreateSubmit(values: TagFormValues) {
    createMutation.mutate(
      { name: values.name, colorHex: values.colorHex, description: values.description || undefined },
      {
        onSuccess: (tag) => {
          setCreateOpen(false);
          if (tag.tagId) {
            onReplace([...assignedIds, tag.tagId]);
          }
        },
      },
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button ref={triggerRef} type="button" variant="ghost" size="icon-xs" aria-label={t('library.tags.open')}>
            <TagIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          {tagsQuery.isPending ? (
            <p className="text-body text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {tags.length === 0 ? (
                <p className="text-body text-muted-foreground">{t('library.tags.empty')}</p>
              ) : (
                <ul className="flex max-h-64 flex-col gap-2.5 overflow-y-auto">
                  {tags.map((tag) => (
                    <li key={tag.tagId}>
                      <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                        {/* Disabled mid-write — a second tick before the first replace-call
                            returns would compute its set from stale `assignedTags` data. */}
                        <Checkbox
                          checked={Boolean(tag.tagId) && assignedIds.has(tag.tagId ?? '')}
                          disabled={isReplacing}
                          onCheckedChange={() => tag.tagId && toggleTag(tag.tagId)}
                        />
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={tag.colorHex ? { backgroundColor: tag.colorHex } : undefined}
                          aria-hidden="true"
                        />
                        {tag.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" variant="outline" size="sm" onClick={handleCreateClick}>
                <Plus className="size-3.5" aria-hidden="true" />
                {t('library.tags.createTag')}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <TagFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        isPending={createMutation.isPending}
        onSubmit={handleCreateSubmit}
        onCloseAutoFocus={handleCreateDialogCloseAutoFocus}
        labels={{
          title: t('library.tags.createTitle'),
          description: t('library.tags.createDescription'),
          nameLabel: t('library.tags.nameLabel'),
          namePlaceholder: t('library.tags.namePlaceholder'),
          colorLabel: t('library.tags.colorLabel'),
          descriptionLabel: t('library.tags.descriptionLabel'),
          descriptionPlaceholder: t('library.tags.descriptionPlaceholder'),
          previewLabel: t('library.tags.previewLabel'),
          previewSampleName: t('library.tags.previewSampleName'),
          submitLabel: t('library.tags.createSubmit'),
          savingLabel: t('common.saving'),
          cancelLabel: t('common.cancel'),
          nameRequiredError: t('library.tags.validation.nameRequired'),
          colorInvalidError: t('library.tags.validation.colorInvalid'),
          colorPresetLabels: {
            red: t('library.tags.colors.red'),
            orange: t('library.tags.colors.orange'),
            yellow: t('library.tags.colors.yellow'),
            green: t('library.tags.colors.green'),
            blue: t('library.tags.colors.blue'),
            purple: t('library.tags.colors.purple'),
            pink: t('library.tags.colors.pink'),
            grey: t('library.tags.colors.grey'),
          },
        }}
      />
    </>
  );
}
