namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Type of notification sent to a user.
/// </summary>
public enum NotificationType
{
    /// <summary>Client achieved a personal record.</summary>
    PersonalRecord,

    /// <summary>A new training plan was published.</summary>
    PlanPublished,

    /// <summary>General system notification.</summary>
    General
}
