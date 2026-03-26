/** Muscle group enum values. */
export type MuscleGroup =
  | 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Forearms'
  | 'Quadriceps' | 'Hamstrings' | 'Glutes' | 'Calves'
  | 'Abs' | 'Obliques' | 'LowerBack' | 'Traps' | 'FullBody';

/** Equipment enum values. */
export type ExerciseEquipment =
  | 'None' | 'Dumbbells' | 'Barbell' | 'Machine' | 'TRX' | 'Kettlebell' | 'Bodyweight';

/** Category enum values. */
export type ExerciseCategory = 'Strength' | 'Cardio' | 'Mobility' | 'Technique' | 'Warmup';

/** Difficulty enum values. */
export type ExerciseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

/** Exercise summary for list views. */
export interface ExerciseSummary {
  exerciseId: string;
  name: string;
  rawName: string;
  nameEn?: string | null;
  nameCs?: string | null;
  nameDe?: string | null;
  muscleGroups: MuscleGroup[];
  equipment: ExerciseEquipment;
  category: ExerciseCategory;
  difficulty: ExerciseDifficulty;
  thumbnailUrl?: string | null;
  isCustom: boolean;
}

/** Full exercise detail. */
export interface ExerciseDetail extends ExerciseSummary {
  description?: string | null;
  videoUrl?: string | null;
  techniqueNotes?: string | null;
  source: string;
}

/** Paginated exercise search response. */
export interface SearchExercisesResponse {
  exercises: ExerciseSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Request to create a custom exercise. */
export interface CreateExerciseRequest {
  name: string;
  nameEn?: string | null;
  nameCs?: string | null;
  nameDe?: string | null;
  description?: string | null;
  muscleGroups: MuscleGroup[];
  equipment: ExerciseEquipment;
  category: ExerciseCategory;
  difficulty: ExerciseDifficulty;
  techniqueNotes?: string | null;
}

/** Request to update a custom exercise. */
export interface UpdateExerciseRequest extends CreateExerciseRequest {}

/** Response from upload URL generation. */
export interface UploadUrlResponse {
  uploadUrl: string;
  videoUrl: string;
}
