import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FULL_PLAN_KEY, TODAY_LOG_KEY, TODAY_PLAN_KEY, WEEK_LOG_KEY, addMealPhoto } from '@/api/nutrition';
import type { StoredMealPhotos } from '@/api/nutrition';
import type { PickedPhoto } from '@/api/photos';

export type AddDayMealPhotoVariables = {
  mealId: string;
  /** The plan day the photo belongs to, `yyyy-MM-dd`. */
  date: string;
  photo: PickedPhoto;
  /** Photos already stored for that meal and day; the save replaces the whole list. */
  existing: StoredMealPhotos;
};

/** Uploads one picked photo to the log of a meal on a given day; the logs refetch once it is saved. */
export function useAddDayMealPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, date, photo, existing }: AddDayMealPhotoVariables) =>
      addMealPhoto(mealId, photo, existing, date),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WEEK_LOG_KEY });
      void queryClient.invalidateQueries({ queryKey: TODAY_LOG_KEY });
      void queryClient.invalidateQueries({ queryKey: TODAY_PLAN_KEY });
      void queryClient.invalidateQueries({ queryKey: FULL_PLAN_KEY });
    },
  });
}
