import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useClientTags } from '@/hooks/useClientsQueries';
import { cn } from '@/lib/utils';
import CreateTagDialog from '@/components/clients/CreateTagDialog';

interface Props {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

/**
 * Tag multi-select for filtering the table, plus a "+ Create tag" entry
 * point into CreateTagDialog (closes itself first, reopens on success).
 */
export default function ClientTagFilterPopover({ selectedTagIds, onChange }: Props) {
  const { t } = useTranslation();
  const tagsQuery = useClientTags();
  const tags = tagsQuery.data ?? [];
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Drop ids for tags no longer owned by the caller (e.g. deleted in
  // another tab) — see useClientListParams' doc comment: the backend
  // safely no-ops an unknown tag id, but the picker is the layer that
  // should stop rendering a ghost selection for one.
  useEffect(() => {
    if (!tagsQuery.isSuccess) {
      return;
    }
    const validIds = new Set(tags.map((tag) => tag.tagId).filter((id): id is string => Boolean(id)));
    const pruned = selectedTagIds.filter((id) => validIds.has(id));
    if (pruned.length !== selectedTagIds.length) {
      onChange(pruned);
    }
    // Only re-run when the fetched tag set settles, not on every parent
    // re-render (`onChange`/`selectedTagIds` are recreated each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagsQuery.isSuccess, tags]);

  function toggleTag(tagId: string) {
    onChange(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId],
    );
  }

  function handleCreateClick() {
    setOpen(false);
    setCreateOpen(true);
  }

  // Reopens the filter popover once the tag is created, so the new tag is
  // visible in the (now refetched, via useCreateClientTag's invalidation)
  // list. Deliberately does not select it — a fresh tag has zero clients,
  // so auto-selecting would filter the table to empty right after creation.
  function handleCreated() {
    setOpen(true);
  }

  function handleCreateDialogCloseAutoFocus(event: Event) {
    event.preventDefault();
    triggerRef.current?.focus();
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button ref={triggerRef} type="button" variant="outline" size="sm" className="gap-2">
            {t('clients.tagFilter.label')}
            {selectedTagIds.length > 0 && <span className="text-caption">{selectedTagIds.length}</span>}
            <ChevronDown className="size-3" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          {tagsQuery.isPending ? (
            <p className="text-body text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {tags.length === 0 ? (
                <p className="text-body text-muted-foreground">{t('clients.tagFilter.empty')}</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {tags.map((tag) => (
                    <li key={tag.tagId}>
                      <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                        <Checkbox
                          checked={Boolean(tag.tagId) && selectedTagIds.includes(tag.tagId ?? '')}
                          onCheckedChange={() => tag.tagId && toggleTag(tag.tagId)}
                        />
                        <span
                          className={cn('size-2.5 shrink-0 rounded-full', !tag.colorHex && 'bg-muted-foreground')}
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
                {t('clients.tagPicker.createTag')}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <CreateTagDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
        onCloseAutoFocus={handleCreateDialogCloseAutoFocus}
      />
    </>
  );
}
