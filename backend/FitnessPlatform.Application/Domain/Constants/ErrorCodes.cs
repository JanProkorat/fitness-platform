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

    // ── Foods ────────────────────────────────────────────────────────
    /// <summary>Kcal value is inconsistent with macronutrients.</summary>
    public const string KcalInconsistent = "KCAL_INCONSISTENT";

    /// <summary>User can only edit/delete their own custom foods.</summary>
    public const string FoodNotOwned = "FOOD_NOT_OWNED";

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

    // ── Validation (generic) ─────────────────────────────────────────
    /// <summary>Required field is missing.</summary>
    public const string Required = "REQUIRED";

    /// <summary>Value is out of allowed range.</summary>
    public const string OutOfRange = "OUT_OF_RANGE";
}
