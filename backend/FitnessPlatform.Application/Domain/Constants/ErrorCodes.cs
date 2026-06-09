namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Constants for API error codes used in validation and business logic errors.
/// These codes are returned in ProblemDetails responses and mapped to translated messages on the frontend.
/// </summary>
public static class ErrorCodes
{
    // ── Auth ─────────────────────────────────────────────────────────
    /// <summary>Invalid email or password during login.</summary>
    public const string InvalidCredentials = "INVALID_CREDENTIALS";

    /// <summary>Account is deactivated.</summary>
    public const string AccountDeactivated = "ACCOUNT_DEACTIVATED";

    /// <summary>Invalid or expired refresh token.</summary>
    public const string InvalidRefreshToken = "INVALID_REFRESH_TOKEN";

    /// <summary>Invalid password reset request.</summary>
    public const string InvalidResetRequest = "INVALID_RESET_REQUEST";

    /// <summary>Invalid invitation token.</summary>
    public const string InvalidInvitation = "INVALID_INVITATION";

    /// <summary>Invitation already used.</summary>
    public const string InvitationAlreadyUsed = "INVITATION_ALREADY_USED";

    /// <summary>Invitation has expired.</summary>
    public const string InvitationExpired = "INVITATION_EXPIRED";

    /// <summary>Invalid or expired email verification token.</summary>
    public const string InvalidVerificationToken = "INVALID_VERIFICATION_TOKEN";

    /// <summary>Email verification token has expired.</summary>
    public const string VerificationTokenExpired = "VERIFICATION_TOKEN_EXPIRED";

    /// <summary>Maximum number of verification emails has been reached.</summary>
    public const string VerificationResendLimitReached = "VERIFICATION_RESEND_LIMIT_REACHED";

    /// <summary>Email is already verified.</summary>
    public const string EmailAlreadyVerified = "EMAIL_ALREADY_VERIFIED";

    // ── Users ────────────────────────────────────────────────────────
    /// <summary>User already has the requested role.</summary>
    public const string RoleAlreadyAssigned = "ROLE_ALREADY_ASSIGNED";

    /// <summary>Account deletion failed.</summary>
    public const string AccountDeletionFailed = "ACCOUNT_DELETION_FAILED";

    /// <summary>The supplied IANA time zone identifier is not valid.</summary>
    public const string InvalidTimeZone = "INVALID_TIME_ZONE";

    // ── Foods ────────────────────────────────────────────────────────
    /// <summary>Kcal value is inconsistent with macronutrients.</summary>
    public const string KcalInconsistent = "KCAL_INCONSISTENT";

    /// <summary>User can only edit/delete their own custom foods.</summary>
    public const string FoodNotOwned = "FOOD_NOT_OWNED";

    /// <summary>Food gallery is at its 6-entry cap; no further images can be added.</summary>
    public const string FoodGalleryFull = "FOOD_GALLERY_FULL";

    // ── Recipes ──────────────────────────────────────────────────────
    /// <summary>User can only edit/delete/upload images for their own recipes.</summary>
    public const string RecipeNotOwned = "RECIPE_NOT_OWNED";

    /// <summary>Recipe gallery is at its 6-entry cap; no further images can be added.</summary>
    public const string RecipeGalleryFull = "RECIPE_GALLERY_FULL";

    // ── Exercises ──────────────────────────────────────────────────
    /// <summary>User can only edit/delete their own custom exercises.</summary>
    public const string ExerciseNotOwned = "EXERCISE_NOT_OWNED";

    /// <summary>Cannot modify system exercises.</summary>
    public const string SystemExercise = "SYSTEM_EXERCISE";

    // ── Trainers ─────────────────────────────────────────────────────
    /// <summary>Trainer profile not found.</summary>
    public const string TrainerProfileMissing = "TRAINER_PROFILE_MISSING";

    /// <summary>Client not found.</summary>
    public const string ClientNotFound = "CLIENT_NOT_FOUND";

    /// <summary>No active relationship with client.</summary>
    public const string NoClientRelationship = "NO_CLIENT_RELATIONSHIP";

    /// <summary>Collaborator not found.</summary>
    public const string CollaboratorNotFound = "COLLABORATOR_NOT_FOUND";

    /// <summary>Collaborator already linked to client.</summary>
    public const string CollaboratorAlreadyLinked = "COLLABORATOR_ALREADY_LINKED";

    // ── Nutrition Plans ──────────────────────────────────────────────
    /// <summary>Only draft plans can be published.</summary>
    public const string PlanNotDraft = "PLAN_NOT_DRAFT";

    /// <summary>Only active plans can be completed.</summary>
    public const string PlanNotActive = "PLAN_NOT_ACTIVE";

    // ── Plan Start Date ────────────────────────────────────────────
    /// <summary>Start date is not a Monday.</summary>
    public const string StartDateNotMonday = "START_DATE_NOT_MONDAY";

    /// <summary>Start date is in the past.</summary>
    public const string StartDateInPast = "START_DATE_IN_PAST";

    /// <summary>Start date is locked because it has already arrived.</summary>
    public const string StartDateLocked = "START_DATE_LOCKED";

    /// <summary>Start date is required before publishing.</summary>
    public const string StartDateRequired = "START_DATE_REQUIRED";

    /// <summary>The target week's start Monday is in the past.</summary>
    public const string WeekStartInPast = "WEEK_START_IN_PAST";

    // ── Client Requests ───────────────────────────────────────────────
    /// <summary>Professional profile not found.</summary>
    public const string ProfessionalNotFound = "PROFESSIONAL_NOT_FOUND";

    /// <summary>Client and professional are already linked.</summary>
    public const string AlreadyLinked = "ALREADY_LINKED";

    /// <summary>A pending request already exists for this professional.</summary>
    public const string RequestAlreadyPending = "REQUEST_ALREADY_PENDING";

    /// <summary>Professional is not accepting new clients.</summary>
    public const string ProfessionalNotAccepting = "PROFESSIONAL_NOT_ACCEPTING";

    /// <summary>Client request not found.</summary>
    public const string ClientRequestNotFound = "CLIENT_REQUEST_NOT_FOUND";

    // ── Training Completion ──────────────────────────────────────────
    /// <summary>The training completion document version is stale; another write occurred first.</summary>
    public const string TrainingCompletionVersionConflict = "TRAINING_COMPLETION_VERSION_CONFLICT";

    /// <summary>The session ID was not found in the client's active training plan.</summary>
    public const string TrainingSessionNotFound = "TRAINING_SESSION_NOT_FOUND";

    /// <summary>The exercise was not found in the specified session.</summary>
    public const string TrainingExerciseNotFound = "TRAINING_EXERCISE_NOT_FOUND";

    /// <summary>The section was not found in the specified session.</summary>
    public const string TrainingSectionNotFound = "TRAINING_SECTION_NOT_FOUND";

    /// <summary>No active training plan found for the client.</summary>
    public const string NoActiveTrainingPlan = "NO_ACTIVE_TRAINING_PLAN";

    // ── Weekly Check-Ins ──────────────────────────────────────────────
    /// <summary>TimeOfDay must be hour-aligned (minutes, seconds, and milliseconds must all be zero).</summary>
    public const string InvalidTimeOfDay = "INVALID_TIME_OF_DAY";

    /// <summary>The requested profession is not in the trainer's specializations.</summary>
    public const string ProfessionNotSpecialized = "PROFESSION_NOT_SPECIALIZED";

    /// <summary>The trainer is not linked to the specified client.</summary>
    public const string NotLinkedToClient = "NOT_LINKED_TO_CLIENT";

    /// <summary>The weekly check-in was not found or does not belong to the caller.</summary>
    public const string CheckInNotFound = "CHECK_IN_NOT_FOUND";

    /// <summary>The trainer already reviewed this check-in; the client can no longer modify it.</summary>
    public const string CheckInAlreadyReviewed = "CHECK_IN_ALREADY_REVIEWED";

    /// <summary>The weekly check-in belongs to another professional.</summary>
    public const string CheckInNotOwned = "CHECK_IN_NOT_OWNED";

    /// <summary>The weekly check-in has expired; the client can no longer respond or dismiss it.</summary>
    public const string CheckInExpired = "CHECK_IN_EXPIRED";

    // ── Plan Photos ───────────────────────────────────────────────────
    /// <summary>Only the uploader can delete their own plan photo.</summary>
    public const string PlanPhotoNotOwned = "PLAN_PHOTO_NOT_OWNED";

    /// <summary>Plan photo not found.</summary>
    public const string PlanPhotoNotFound = "PLAN_PHOTO_NOT_FOUND";

    /// <summary>No active plan (nutrition or training) found for the given planId.</summary>
    public const string PlanNotFound = "PLAN_NOT_FOUND";

    /// <summary>
    /// BlobUrl does not match the expected storage prefix for this plan
    /// (<c>plan-photos/{planId}/{guid}.{ext}</c>). Prevents path traversal and cross-plan hijacking.
    /// </summary>
    public const string InvalidBlobUrl = "INVALID_BLOB_URL";

    // ── Image Uploads ────────────────────────────────────────────────
    /// <summary>Content type is not in the allowed image whitelist (image/jpeg, image/png, image/webp).</summary>
    public const string InvalidImageContentType = "INVALID_IMAGE_CONTENT_TYPE";

    /// <summary>Image file size exceeds the 5 MiB limit.</summary>
    public const string ImageTooLarge = "IMAGE_TOO_LARGE";

    /// <summary>
    /// subPath tried to escape the scope prefix: it contains <c>..</c>, a backslash (<c>\</c>),
    /// starts with a leading <c>/</c>, or is null/empty/whitespace.
    /// </summary>
    public const string InvalidImageSubPath = "INVALID_IMAGE_SUB_PATH";

    // ── Photo Diary Requests ─────────────────────────────────────────
    /// <summary>Photo diary request not found or does not belong to the caller.</summary>
    public const string PhotoDiaryRequestNotFound = "PHOTO_DIARY_REQUEST_NOT_FOUND";

    /// <summary>The photo diary request is not in the expected status for this operation.</summary>
    public const string PhotoDiaryRequestInvalidStatus = "PHOTO_DIARY_REQUEST_INVALID_STATUS";

    /// <summary>Exactly one of linkId or pendingInviteId must be set.</summary>
    public const string PhotoDiaryRequestLinkXorInvite = "PHOTO_DIARY_REQUEST_LINK_XOR_INVITE";

    /// <summary>The referenced client-professional link does not belong to the calling professional.</summary>
    public const string PhotoDiaryRequestLinkNotOwned = "PHOTO_DIARY_REQUEST_LINK_NOT_OWNED";

    /// <summary>The referenced pending invite does not belong to the calling professional.</summary>
    public const string PhotoDiaryRequestInviteNotOwned = "PHOTO_DIARY_REQUEST_INVITE_NOT_OWNED";

    /// <summary>The referenced plan does not belong to the client associated with this link/invite.</summary>
    public const string PhotoDiaryRequestPlanNotOwned = "PHOTO_DIARY_REQUEST_PLAN_NOT_OWNED";

    // ── Section Templates ────────────────────────────────────────────
    /// <summary>Section template not found.</summary>
    public const string SectionTemplateNotFound = "SECTION_TEMPLATE_NOT_FOUND";

    /// <summary>Section template belongs to another trainer.</summary>
    public const string SectionTemplateNotOwned = "SECTION_TEMPLATE_NOT_OWNED";

    /// <summary>Section template version mismatch (optimistic concurrency).</summary>
    public const string SectionTemplateVersionConflict = "SECTION_TEMPLATE_VERSION_CONFLICT";

    // ── Training Sections ────────────────────────────────────────────
    /// <summary>Session sections list is empty.</summary>
    public const string SectionsRequired = "SECTIONS_REQUIRED";

    /// <summary>Duplicate Order values across sections in the same session.</summary>
    public const string SectionOrderDuplicate = "SECTION_ORDER_DUPLICATE";

    // ── Trainer Finish Session ───────────────────────────────────────
    /// <summary>The session is currently locked by another party (live or editing lock conflict).</summary>
    public const string SessionLocked = "session_locked";

    /// <summary>The session already has a completed workout log; cannot finish again.</summary>
    public const string SessionAlreadyCompleted = "SESSION_ALREADY_COMPLETED";

    /// <summary>
    /// Attempt to edit a training plan section whose content has already been completed
    /// by the client (via a finished WorkoutLog or a TrainingCompletion record).
    /// </summary>
    public const string SectionAlreadyCompleted = "SECTION_ALREADY_COMPLETED";

    /// <summary>completedAt is in the future; backdating to the future is not allowed.</summary>
    public const string CompletedAtInFuture = "COMPLETED_AT_IN_FUTURE";

    /// <summary>completedAt is before the plan's start date; history cannot be written before the plan began.</summary>
    public const string CompletedAtBeforePlanStart = "COMPLETED_AT_BEFORE_PLAN_START";

    // ── Trainer Notes ─────────────────────────────────────────────────
    /// <summary>Trainer note not found or belongs to a different trainer/client.</summary>
    public const string TrainerNoteNotFound = "TRAINER_NOTE_NOT_FOUND";

    // ── Validation (generic) ─────────────────────────────────────────
    /// <summary>Required field is missing.</summary>
    public const string Required = "REQUIRED";

    /// <summary>Value is out of allowed range.</summary>
    public const string OutOfRange = "OUT_OF_RANGE";

    /// <summary>DeadlineOffsetHours is not one of the allowed values (24, 48, 72, 120, 168).</summary>
    public const string InvalidDeadlineOffsetHours = "INVALID_DEADLINE_OFFSET_HOURS";
}
