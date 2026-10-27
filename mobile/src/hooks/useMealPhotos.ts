import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FULL_PLAN_KEY, TODAY_LOG_KEY, TODAY_PLAN_KEY, addMealPhoto } from '@/api/nutrition';
import type { StoredMealPhotos } from '@/api/nutrition';
import type { PickedPhoto } from '@/api/photos';

type AddPhotoVariables = { photo: PickedPhoto; existing: StoredMealPhotos };

/** Uploads one picked photo to today's log of the meal; the log refetches once it is saved. */
export function useMealPhotos(mealId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photo, existing }: AddPhotoVariables) => addMealPhoto(mealId, photo, existing),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TODAY_LOG_KEY });
      void queryClient.invalidateQueries({ queryKey: TODAY_PLAN_KEY });
      void queryClient.invalidateQueries({ queryKey: FULL_PLAN_KEY });
    },
  });
}
