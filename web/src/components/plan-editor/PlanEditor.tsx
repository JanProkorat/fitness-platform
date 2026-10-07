import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { AlertTriangle, PanelLeftOpen } from 'lucide-react';
import { MealKind } from '@/api/generated';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AveragesBar from '@/components/plan-editor/AveragesBar';
import LibraryPanel from '@/components/plan-editor/LibraryPanel';
import MealPicker from '@/components/plan-editor/MealPicker';
import PlanEditorHeader from '@/components/plan-editor/PlanEditorHeader';
import WeekGrid, { type SelectedCell } from '@/components/plan-editor/WeekGrid';
import WeekTabs from '@/components/plan-editor/WeekTabs';
import { weekSummary } from '@/components/plan-editor/plan-editor-nutrition';
import {
  addItemToCell,
  addMealRow,
  addWeek,
  applyMealKinds,
  COMMON_MEAL_KINDS,
  nextSnackKind,
  weekHasItems,
  weekRows,
} from '@/components/plan-editor/plan-editor-ops';
import type { EditorDocument, LibraryItem, SaveStatus } from '@/components/plan-editor/plan-editor-types';
import { usePlanEditorState } from '@/components/plan-editor/usePlanEditorState';

export interface PlanEditorSaveState {
  status: SaveStatus;
  /** Shown in the error banner for `error` and `conflict`. */
  message?: string;
}

interface Props {
  /** The document to edit. Remount (change `key`) to load a different one. */
  initial: EditorDocument;
  dailyKcalTarget?: number;
  readOnly: boolean;
  readOnlyNotice?: string;
  breadcrumb: { label: string; onNavigate: () => void };
  saveState: PlanEditorSaveState;
  /** Persists the document; resolves with the server's copy, or null when the save failed. */
  onSave: (doc: EditorDocument) => Promise<EditorDocument | null>;
  /** Drops local edits and loads the latest server version (offered after a conflict). */
  onReload: () => void;
}

function isLibraryItem(value: unknown): value is LibraryItem {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }
  return value.type === 'recipe' || value.type === 'food';
}

function readItem(data: unknown): LibraryItem | null {
  if (typeof data !== 'object' || data === null || !('item' in data)) {
    return null;
  }
  return isLibraryItem(data.item) ? data.item : null;
}

function readCell(data: unknown): SelectedCell | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const candidate = data as { dayOfWeek?: unknown; rowIndex?: unknown };
  return typeof candidate.dayOfWeek === 'number' && typeof candidate.rowIndex === 'number'
    ? { dayOfWeek: candidate.dayOfWeek, rowIndex: candidate.rowIndex }
    : null;
}

function itemName(item: LibraryItem): string {
  return item.type === 'recipe' ? item.recipe.recipeName : item.food.foodName;
}

/**
 * The shared plan editor: week grid, library panel and header. Knows nothing about where the plan
 * comes from; the host loads it, saves it and decides who may edit.
 */
export default function PlanEditor({
  initial,
  dailyKcalTarget,
  readOnly,
  readOnlyNotice,
  breadcrumb,
  saveState,
  onSave,
  onReload,
}: Props) {
  const { t } = useTranslation();
  const { doc, dirty, canUndo, edit, undo, markSaved } = usePlanEditorState(initial);
  const [weekIndex, setWeekIndex] = useState(0);
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [pickerSession, setPickerSession] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const expandRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const libraryToggled = useRef(false);

  const currentIndex = Math.min(weekIndex, doc.weeks.length - 1);
  const week = doc.weeks[currentIndex];
  const rows = week ? weekRows(week) : [];
  const showPicker = !readOnly && (rows.length === 0 || pickerSession);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Keep keyboard focus on the visible toggle: the collapse button goes inert, the expand button unmounts.
  useEffect(() => {
    if (!libraryToggled.current) {
      return;
    }
    (libraryOpen ? collapseRef : expandRef).current?.focus({ preventScroll: true });
  }, [libraryOpen]);

  function toggleLibrary(open: boolean) {
    libraryToggled.current = true;
    setLibraryOpen(open);
  }

  function selectWeek(index: number) {
    setWeekIndex(index);
    setSelected(null);
    setPickerSession(false);
  }

  function addToCell(item: LibraryItem, cell: SelectedCell) {
    setPickerSession(false);
    edit((current) => addItemToCell(current, currentIndex, cell.dayOfWeek, cell.rowIndex, item));
  }

  function applyCommonMeals() {
    edit((current) =>
      applyMealKinds(
        current,
        current.weeks.map((_, index) => index),
        COMMON_MEAL_KINDS,
      ),
    );
  }

  /** Adds a row to this week and to every empty week that has the same rows. */
  function addMealKind(kind: MealKind) {
    setPickerSession(true);
    edit((current) => {
      const currentWeek = current.weeks[currentIndex];
      if (!currentWeek) {
        return current;
      }
      const signature = weekRows(currentWeek)
        .map((row) => row.kind)
        .join();
      const kindToAdd = kind === MealKind.MorningSnack ? nextSnackKind(currentWeek) : kind;
      return current.weeks.reduce(
        (result, candidate, index) =>
          index === currentIndex ||
          (!weekHasItems(candidate) &&
            weekRows(candidate)
              .map((row) => row.kind)
              .join() === signature)
            ? addMealRow(result, index, kindToAdd)
            : result,
        current,
      );
    });
  }

  async function save() {
    const sent = doc;
    const saved = await onSave(sent);
    if (saved) {
      markSaved(saved, sent);
    }
  }

  function leave() {
    if (dirty) {
      setLeaveOpen(true);
      return;
    }
    breadcrumb.onNavigate();
  }

  if (!week) {
    return null;
  }

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) {
          return;
        }
        const item = readItem(event.operation.source?.data);
        const cell = readCell(event.operation.target?.data);
        if (item && cell) {
          setSelected(cell);
          addToCell(item, cell);
        }
      }}
    >
      <div className="flex h-full min-h-0">
        {!readOnly && (
          <div
            className={cn(
              'relative shrink-0 overflow-hidden transition-[width] duration-300 ease-out motion-reduce:transition-none',
              libraryOpen ? 'w-80' : 'w-13',
            )}
          >
            <LibraryPanel
              open={libraryOpen}
              collapseRef={collapseRef}
              canAdd={selected !== null}
              disabled={readOnly}
              onAdd={(item) => selected && addToCell(item, selected)}
              onCollapse={() => toggleLibrary(false)}
            />
            <button
              ref={expandRef}
              type="button"
              inert={libraryOpen}
              aria-label={t('planEditor.library.expand')}
              title={t('planEditor.library.expand')}
              onClick={() => toggleLibrary(true)}
              className={cn(
                'absolute inset-y-0 left-0 z-10 flex w-13 cursor-pointer flex-col items-center gap-3.5 border-r-2 border-line bg-sunken py-4 shadow-panel outline-none transition-opacity duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none',
                libraryOpen ? 'opacity-0' : 'opacity-100 delay-150 motion-reduce:delay-0',
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-field border border-line bg-card text-ink">
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              </span>
              <span className="text-label font-bold tracking-label text-ink-2 uppercase [writing-mode:vertical-rl] rotate-180">
                {t('planEditor.library.title')}
              </span>
            </button>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <PlanEditorHeader
                name={doc.name}
                onNameChange={(name) => edit((current) => ({ ...current, name }), 'name')}
                breadcrumbLabel={breadcrumb.label}
                onBreadcrumb={leave}
                readOnly={readOnly}
                dirty={dirty}
                saveStatus={saveState.status}
                canUndo={canUndo}
                onUndo={undo}
                onSave={() => void save()}
              />
            </div>
          </div>

          {readOnly && readOnlyNotice && (
            <p role="note" className="rounded-xl border border-line bg-muted px-4 py-3 text-body text-ink">
              {readOnlyNotice}
            </p>
          )}

          {(saveState.status === 'conflict' || saveState.status === 'error') && saveState.message && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-xl border border-error bg-error-soft px-4 py-3 text-body text-error"
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{saveState.message}</span>
              {saveState.status === 'conflict' && (
                <Button type="button" variant="destructive" size="sm" onClick={onReload}>
                  {t('planEditor.conflict.reload')}
                </Button>
              )}
            </div>
          )}

          <WeekTabs
            weekCount={doc.weeks.length}
            current={currentIndex}
            readOnly={readOnly}
            onSelect={selectWeek}
            onAddWeek={() => {
              edit(addWeek);
              selectWeek(doc.weeks.length);
            }}
          />

          <AveragesBar summary={weekSummary(week)} dailyKcalTarget={dailyKcalTarget} />

          {rows.length > 0 && (
            <WeekGrid
              week={week}
              weekIndex={currentIndex}
              dailyKcalTarget={dailyKcalTarget}
              selected={selected}
              readOnly={readOnly}
              onSelect={setSelected}
            />
          )}

          {showPicker && (
            <MealPicker
              hasRows={rows.length > 0}
              onApplyCommon={applyCommonMeals}
              onAddKind={addMealKind}
              onDone={() => setPickerSession(false)}
            />
          )}
        </div>
      </div>

      <DragOverlay>
        {(source) => {
          const item = readItem(source.data);
          return item ? (
            <div className="rounded-xl border border-line bg-card px-4 py-3 text-copy font-semibold text-ink shadow-popover">
              {itemName(item)}
            </div>
          ) : null;
        }}
      </DragOverlay>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('planEditor.leave.title')}</DialogTitle>
            <DialogDescription>{t('planEditor.leave.body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLeaveOpen(false)}>
              {t('planEditor.leave.stay')}
            </Button>
            <Button type="button" variant="destructive" onClick={breadcrumb.onNavigate}>
              {t('planEditor.leave.discard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DragDropProvider>
  );
}
