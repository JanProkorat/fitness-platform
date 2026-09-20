import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useClientTags } from '@/hooks/useClientsQueries';
import { cn } from '@/lib/utils';

interface Props {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

/**
 * Tag multi-select for filtering the table. Not the per-row tag *picker*
 * (that dropdown, plus the create-tag modal, is phase 4) — this is a
 * read-only-against-tags, filter-only control built on the Popover
 * primitive rather than DropdownMenu so multi-select doesn't need to fight
 * Radix's close-on-select default.
 */
export default function ClientTagFilterPopover({ selectedTagIds, onChange }: Props) {
  const { t } = useTranslation();
  const tagsQuery = useClientTags();
  const tags = tagsQuery.data ?? [];

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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          {t('clients.tagFilter.label')}
          {selectedTagIds.length > 0 && <span className="text-caption">{selectedTagIds.length}</span>}
          <ChevronDown className="size-3" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        {tagsQuery.isPending ? (
          <p className="text-body text-muted-foreground">{t('common.loading')}</p>
        ) : tags.length === 0 ? (
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
      </PopoverContent>
    </Popover>
  );
}
