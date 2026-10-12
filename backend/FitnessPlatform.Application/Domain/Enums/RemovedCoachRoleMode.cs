namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// How a single-discipline write endpoint behaves once the caller has removed that coach role.
/// </summary>
public enum RemovedCoachRoleMode
{
    /// <summary>The write is refused with COACH_ROLE_REMOVED.</summary>
    Refuse,

    /// <summary>The write is allowed only on an in-progress plan the caller owns.</summary>
    WhilePlanInProgress,

    /// <summary>The endpoint is stateless and stays open; requires a reason.</summary>
    Exempt,
}
