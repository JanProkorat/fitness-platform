import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18n from '@/i18n';
import {
  createQuestionnaire,
  deleteQuestionnaire,
  getTrainerQuestionnaire,
  getTrainerQuestionnaires,
  QuestionnaireType,
  updateQuestionnaire,
  type QuestionnaireDto,
} from '@/api/questionnaires';
import { showApiError, showSuccess } from '@/lib/api-errors';
import { useAuthStore } from '@/stores/auth';

interface TrainerQuestionnairesOptions {
  /** Only forms of this type; omit for every type. */
  type?: QuestionnaireType;
  /** Case-insensitive title substring; omit or leave empty for no text filter. */
  search?: string;
}

/** The caller's questionnaires (all, active and inactive). Callers filter `isActive` themselves. */
export function useTrainerQuestionnaires({ type, search = '' }: TrainerQuestionnairesOptions = {}) {
  const isProfessional = useAuthStore(
    (state) => state.user?.roles.some((role) => role === 'Trainer' || role === 'Nutritionist') ?? false,
  );
  return useQuery({
    queryKey: ['questionnaires', 'trainer', type ?? 'all', search],
    queryFn: () => getTrainerQuestionnaires({ type, search }),
    enabled: isProfessional,
  });
}

/** Creates an empty form of the chosen type; the caller navigates to it on success. */
export function useCreateForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { title: string; description?: string; type: QuestionnaireType }) =>
      createQuestionnaire(variables.title, variables.description, variables.type),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
    },
  });
}

/** Soft-deletes a form. */
export function useDeleteForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => deleteQuestionnaire(publicId),
    onSuccess: () => {
      showSuccess('forms.deleteSuccess');
    },
    onError: (error) => {
      showApiError(error, 'forms.deleteError');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
    },
  });
}

/**
 * Copies a form client-side: read it, create a new one of the same type with a
 * translated copy suffix, then fill in the questions. The create endpoint takes
 * no questions, so a failed fill removes the half-made copy again.
 */
export function useDuplicateForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId: string): Promise<QuestionnaireDto> => {
      const source = await getTrainerQuestionnaire(sourceId);
      const copy = await createQuestionnaire(
        i18n.t('forms.duplicate.titleCopy', { title: source.title }),
        source.description ?? undefined,
        source.type,
      );
      try {
        return await updateQuestionnaire(copy.publicId, {
          title: copy.title,
          description: source.description ?? null,
          type: source.type,
          isActive: true,
          isDefault: false,
          questions: source.questions.map((question) => ({
            publicId: null,
            orderIndex: question.orderIndex,
            type: question.type,
            label: question.label,
            helperText: question.helperText ?? null,
            isRequired: question.isRequired,
            isHidden: question.isHidden,
            config: question.config ?? null,
            mappedField: question.mappedField ?? null,
          })),
        });
      } catch (error) {
        await deleteQuestionnaire(copy.publicId).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: () => {
      showSuccess('forms.duplicate.success');
    },
    onError: (error) => {
      showApiError(error, 'forms.duplicate.error');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
    },
  });
}
