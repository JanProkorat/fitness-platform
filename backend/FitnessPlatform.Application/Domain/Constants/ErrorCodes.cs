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

    // ── Validation (generic) ─────────────────────────────────────────
    /// <summary>Required field is missing.</summary>
    public const string Required = "REQUIRED";

    /// <summary>Value is out of allowed range.</summary>
    public const string OutOfRange = "OUT_OF_RANGE";
}
