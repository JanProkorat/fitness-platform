import { api, http } from '@/api/client';
import type {
  ClientRecipeListItem,
  GetFullPlanResponse,
  GetRecipeResponse,
  GetTodayLogResponse,
  GetTodayPlanResponse,
  GetWeekMealLogMealDto,
  GetWeekMealLogResponse,
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
/** Prefix of every per-week meal log, so one invalidation covers all weeks. */
export const WEEK_LOG_KEY = ['nutrition', 'log', 'week'] as const;
export const weekLogQueryKey = (date: string) => [...WEEK_LOG_KEY, date] as const;
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

/** The meal log of the plan week containing `date` (GET /client/nutrition/log/week). */
export function fetchWeekLog(date: string, signal?: AbortSignal): Promise<GetWeekMealLogResponse> {
  return api.getWeekMealLogEndpoint(date, signal);
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

/** The stored photos and note of a meal in a week log, in the shape the save call takes. */
export const storedWeekMealPhotos = (entry: GetWeekMealLogMealDto | undefined): StoredMealPhotos => ({
  photos: (entry?.photos ?? [])
    .filter((photo) => Boolean(photo.blobUrl))
    .map((photo) => ({ blobUrl: photo.blobUrl ?? '', note: photo.note })),
  note: entry?.note,
});

/** Error code the server sends when a meal log date lies after the client's today. */
export const MEAL_LOG_DATE_IN_FUTURE = 'MEAL_LOG_DATE_IN_FUTURE';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Top-level `errorCode` of a ProblemDetails body carried by a failed generated-client call. */
export function getTopLevelErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  const fromBody = (body: unknown): string | undefined =>
    isRecord(body) && typeof body.errorCode === 'string' ? body.errorCode : undefined;
  const direct = fromBody(error.result);
  if (direct) return direct;
  if (typeof error.response === 'string') {
    try {
      return fromBody(JSON.parse(error.response) as unknown);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Uploads a picked photo for the log of a meal on `date` (the client-local today when omitted): signed URL,
 * direct PUT, then save. Save replaces the whole photo list, so the already stored blob URLs are sent back
 * with the new one.
 */
export async function addMealPhoto(
  mealId: string,
  photo: PickedPhoto,
  existing: StoredMealPhotos,
  date?: string,
): Promise<void> {
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

  const { uploadUrl, blobUrl } = await api.generateMealPhotoUploadUrlEndpoint(mealId, { contentType, sizeBytes, date });
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
    date,
    photos: [...existing.photos, { blobUrl }],
    note: existing.note,
  });
}

/** Query key of the client's recipe list: one cached list per plan, or one for all plans. */
export const recipesQueryKey = (planId?: string) => ['nutrition', 'recipes', planId ?? 'all'] as const;

/** The server rejects a page size above this. */
export const RECIPES_PAGE_SIZE = 100;
/** Upper bound on pages loaded in one go, so a total that keeps growing cannot loop forever. */
export const RECIPES_MAX_PAGES = 20;

export type ClientRecipesPage = { items: ClientRecipeListItem[]; total: number };

/**
 * One page of the client's recipes (GET /client/nutrition/recipes). Calls the HTTP client directly because
 * the generated client drops the X-Total-Count header; a missing header falls back to the page length.
 */
export async function fetchClientRecipes(
  params: { page: number; pageSize: number; planId?: string },
  signal?: AbortSignal,
): Promise<ClientRecipesPage> {
  const response = await http.get<string>('/client/nutrition/recipes', {
    params: { page: params.page, pageSize: params.pageSize, planId: params.planId },
    headers: { Accept: 'application/json' },
    signal,
  });
  const body: unknown = typeof response.data === 'string' && response.data ? JSON.parse(response.data) : response.data;
  const items = isRecord(body) && Array.isArray(body.items) ? (body.items as ClientRecipeListItem[]) : [];
  const header: unknown = response.headers['x-total-count'];
  const total = Number(header);
  return { items, total: header !== undefined && Number.isFinite(total) ? total : items.length };
}

/** Every recipe in scope, paged until the total is reached; any failed page fails the whole load. */
export async function fetchAllClientRecipes(planId?: string, signal?: AbortSignal): Promise<ClientRecipesPage> {
  const items: ClientRecipeListItem[] = [];
  let total = 0;
  for (let page = 1; page <= RECIPES_MAX_PAGES; page += 1) {
    const result = await fetchClientRecipes({ page, pageSize: RECIPES_PAGE_SIZE, planId }, signal);
    total = result.total;
    if (result.items.length === 0) break;
    items.push(...result.items);
    if (items.length >= total) break;
  }
  return { items, total: Math.max(total, items.length) };
}
