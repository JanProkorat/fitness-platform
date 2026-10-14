import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  NutritionPlanTemplateDetailDto,
  UpdateNutritionPlanTemplateRequest,
} from '@/api/nutrition-plan-templates';
import type { PlanEditorSaveState } from '@/components/plan-editor/PlanEditor';
import {
  nullToUndefined,
  toEditorTargets,
  toEditorWeeks,
  toGlobalSettings,
  toRequestWeeks,
} from '@/components/plan-editor/plan-editor-mapping';
import type { EditorDocument } from '@/components/plan-editor/plan-editor-types';
import { useUpdatePlanTemplate } from '@/hooks/usePlanTemplatesQueries';
import { getApiErrorMessage, getErrorStatus } from '@/lib/api-errors';

/** Maps the stored template to the editor's neutral document. Stored totals are ignored. */
export function toEditorDocument(dto: NutritionPlanTemplateDetailDto): EditorDocument {
  return {
    name: dto.name ?? '',
    description: nullToUndefined(dto.description),
    goal: nullToUndefined(dto.goal),
    dietaryStyle: nullToUndefined(dto.dietaryStyle),
    targets: toEditorTargets(dto.globalSettings),
    weeks: toEditorWeeks(dto.weeks),
  };
}

/**
 * The PUT replaces the whole template: the info fields and targets come from the editor document, and
 * what the editor does not change (supplements) is echoed back from the loaded copy.
 */
export function toUpdateRequest(
  loaded: NutritionPlanTemplateDetailDto,
  doc: EditorDocument,
  version: number | undefined,
): UpdateNutritionPlanTemplateRequest {
  return {
    name: doc.name.trim(),
    description: doc.description?.trim() || undefined,
    goal: doc.goal,
    dietaryStyle: doc.dietaryStyle,
    globalSettings: toGlobalSettings(doc.targets),
    supplements: (loaded.supplements ?? []).map((supplement) => ({
      externalId: supplement.externalId,
      name: supplement.name,
      dose: nullToUndefined(supplement.dose),
      notes: nullToUndefined(supplement.notes),
    })),
    weeks: toRequestWeeks(doc.weeks),
    version,
  };
}

/**
 * Host logic for editing a plan template: the editor's initial document, the save call, and the
 * save/conflict state. The loaded copy is captured once, so a background refetch can never change
 * the version the next save is checked against.
 */
export function usePlanTemplateEditor(loadedDto: NutritionPlanTemplateDetailDto) {
  const { t } = useTranslation();
  const [loaded] = useState(loadedDto);
  const [initial] = useState(() => toEditorDocument(loadedDto));
  const versionRef = useRef(loadedDto.version);
  const mutation = useUpdatePlanTemplate(loadedDto.templateId ?? '');
  const [saveState, setSaveState] = useState<PlanEditorSaveState>({ status: 'idle' });

  async function save(doc: EditorDocument): Promise<EditorDocument | null> {
    setSaveState({ status: 'saving' });
    try {
      const saved = await mutation.mutateAsync(toUpdateRequest(loaded, doc, versionRef.current));
      versionRef.current = saved.version;
      setSaveState({ status: 'idle' });
      return toEditorDocument(saved);
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        setSaveState({ status: 'conflict', message: t('planEditor.conflict.message') });
      } else {
        setSaveState({ status: 'error', message: getApiErrorMessage(error, 'planEditor.saveError') });
      }
      return null;
    }
  }

  return { initial, saveState, save };
}
