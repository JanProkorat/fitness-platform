import { api } from '@/api/client';
import type {
  GetFullPlanResponse,
  GetRecipeResponse,
  GetTodayLogResponse,
  GetTodayPlanResponse,
  MealPhotoDto,
  PlanMeal,
  TodayMealLogDto,
} from '@/api/generated';
import { ALLOWED_TYPES, MAX_PHOTO_BYTES, PhotoUploadError, normalizeType } from '@/api/photos';
import type { PickedPhoto } from '@/api/photos';

export const TODAY_PLAN_KEY = ['nutrition', 'plan', 'today'] as const;
export const TODAY_LOG_KEY = ['nutrition', 'log', 'today'] as const;
/** Shared with the plan screens so both read one cached copy of the full plan. */
export const FULL_PLAN_KEY = ['nutrition', 'plan', 'full'] as const;
export const recipeQueryKey = (recipeId: string) => ['nutrition', 'recipe', recipeId] as const;

/** Signed photo URLs live 15 minutes, so the cached log must go stale well before that. */
export const NUTRITION_PHOTO_STALE_MS = 5 * 60 * 1000;

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isNutritionId = (value: string): boolean => ID_PATTERN.test(value);

/** A plan meal that carries its id. */
export type NutritionMeal = PlanMeal & { mealId: string };

export type MealLookup = { meal: NutritionMeal; isToday: boolean };

const hasId = (meal: PlanMeal): meal is NutritionMeal => typeof meal.mealId === 'string';

/** Finds a meal in today's plan first, then anywhere in the published weeks of the full plan. */
export function findMeal(
  mealId: string,
  today: GetTodayPlanResponse | undefined,
  full: GetFullPlanResponse | undefined,
): MealLookup | null {
  const inToday = (today?.meals ?? []).find((meal): meal is NutritionMeal => hasId(meal) && meal.mealId === mealId);
  if (inToday) return { meal: inToday, isToday: true };

  const inFull = (full?.weeks ?? [])
    .flatMap((week) => week.days ?? [])
    .flatMap((day) => day.meals ?? [])
    .find((meal): meal is NutritionMeal => hasId(meal) && meal.mealId === mealId);
  return inFull ? { meal: inFull, isToday: false } : null;
}

/** Today's plan (GET /client/nutrition/plan/today). */
export function fetchTodayPlan(signal?: AbortSignal): Promise<GetTodayPlanResponse> {
  return api.getTodayPlanEndpoint(signal);
}

/** Today's meal log (GET /client/nutrition/log/today). */
export function fetchTodayLog(signal?: AbortSignal): Promise<GetTodayLogResponse> {
  return api.getTodayLogEndpoint(signal);
}

/** The full plan (GET /client/nutrition/plan/full). */
export function fetchFullPlan(signal?: AbortSignal): Promise<GetFullPlanResponse> {
  return api.getFullPlanEndpoint(signal);
}

/** One recipe the client may see (GET /client/recipes/{recipeId}). */
export function fetchRecipe(recipeId: string, signal?: AbortSignal): Promise<GetRecipeResponse> {
  return api.getRecipeDetailEndpoint(recipeId, signal);
}

/**
 * The log of one meal as a single entry. The server returns one row per log record, so a meal can appear
 * twice (a photo-only row and an eaten row): eaten if any row is, photos are the union by blob URL.
 */
export function findMealLog(log: GetTodayLogResponse | undefined, mealId: string): TodayMealLogDto | undefined {
  const rows = (log?.mealsEaten ?? []).filter((entry) => entry.mealId === mealId);
  const [first] = rows;
  if (!first) return undefined;

  const photos = new Map<string, MealPhotoDto>();
  for (const row of rows) {
    for (const photo of row.photos ?? []) {
      if (photo.blobUrl && !photos.has(photo.blobUrl)) photos.set(photo.blobUrl, photo);
    }
  }
  const eatenRow = rows.find((row) => row.eatenAt);
  return {
    ...(eatenRow ?? first),
    eatenAt: eatenRow?.eatenAt,
    note: rows.find((row) => row.note)?.note,
    photos: [...photos.values()],
  };
}

/** A photo the screen can show: both the write identity and the signed read URL are present. */
export type MealPhoto = MealPhotoDto & { blobUrl: string; displayUrl: string };

export const isShownMealPhoto = (photo: MealPhotoDto): photo is MealPhoto =>
  Boolean(photo.blobUrl) && Boolean(photo.displayUrl);

/** Photos of a meal log, oldest first. */
export const mealPhotos = (entry: TodayMealLogDto | undefined): MealPhoto[] =>
  (entry?.photos ?? [])
    .filter(isShownMealPhoto)
    .sort((first, second) => (first.uploadedAt ?? '').localeCompare(second.uploadedAt ?? ''));

/** True when the meal was confirmed as eaten; a photo-only entry has no `eatenAt`. */
export const isMealEaten = (entry: TodayMealLogDto | undefined): boolean => Boolean(entry?.eatenAt);

/** Log with one meal marked eaten or unmarked, used for the optimistic toggle. */
export function withMealEaten(
  log: GetTodayLogResponse | undefined,
  meal: NutritionMeal,
  eaten: boolean,
): GetTodayLogResponse {
  const entries = log?.mealsEaten ?? [];
  const existing = findMealLog(log, meal.mealId);
  const others = entries.filter((entry) => entry.mealId !== meal.mealId);
  const next: GetTodayLogResponse = { ...log, mealsEaten: others };
  if (!eaten) {
    // Unmarking deletes the whole entry on the server, photos included.
    return next;
  }
  const entry: TodayMealLogDto = {
    ...existing,
    mealId: meal.mealId,
    eatenAt: new Date().toISOString(),
    photos: existing?.photos ?? [],
  };
  return { ...next, mealsEaten: [...others, entry] };
}

/** Marks a meal eaten (POST) or unmarks it (DELETE) for the client's local today. */
export async function setMealEaten(mealId: string, eaten: boolean): Promise<void> {
  if (eaten) {
    await api.logMealEatenEndpoint(mealId, {});
  } else {
    await api.unlogMealEatenEndpoint(mealId);
  }
}

/** What the save call must echo back, because it replaces the stored photo list and note. */
export type StoredMealPhotos = { photos: { blobUrl: string; note?: string }[]; note?: string };

/** The stored photos and note of a log entry, in the shape the save call takes. */
export const storedMealPhotos = (entry: TodayMealLogDto | undefined): StoredMealPhotos => ({
  photos: mealPhotos(entry).map((photo) => ({ blobUrl: photo.blobUrl, note: photo.note })),
  note: entry?.note,
});

/**
 * Uploads a picked photo for today's log of a meal: signed URL, direct PUT, then save. Save replaces the
 * whole photo list, so the already stored blob URLs are sent back with the new one.
 */
export async function addMealPhoto(mealId: string, photo: PickedPhoto, existing: StoredMealPhotos): Promise<void> {
  let blob: Blob;
  try {
    blob = await (await fetch(photo.uri)).blob();
  } catch {
    throw new PhotoUploadError('unreadable');
  }

  const contentType = normalizeType(photo.mimeType ?? blob.type);
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new PhotoUploadError('unsupportedType');
  }
  const sizeBytes = photo.fileSize ?? blob.size;
  if (sizeBytes > MAX_PHOTO_BYTES) {
    throw new PhotoUploadError('tooLarge');
  }

  const { uploadUrl, blobUrl } = await api.generateMealPhotoUploadUrlEndpoint(mealId, { contentType, sizeBytes });
  if (!uploadUrl || !blobUrl) {
    throw new PhotoUploadError('upload');
  }

  // Plain fetch on purpose: the shared axios client would add the bearer token, and blob
  // storage must only ever see the query signature.
  let put: Response;
  try {
    put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  } catch {
    throw new PhotoUploadError('upload');
  }
  if (!put.ok) {
    throw new PhotoUploadError('upload');
  }

  await api.saveMealPhotosEndpoint(mealId, {
    photos: [...existing.photos, { blobUrl }],
    note: existing.note,
  });
}
