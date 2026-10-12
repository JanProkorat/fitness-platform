namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// User-facing notification events whose email and push delivery the user can toggle.
/// Stored as an integer; append new members at the end.
/// </summary>
public enum NotificationEvent
{
    /// <summary>A new chat message arrived.</summary>
    NewMessage,

    /// <summary>A client submitted a weekly check-in.</summary>
    WeeklyCheckInSubmitted,

    /// <summary>A client sent a join request to a professional.</summary>
    JoinRequest,

    /// <summary>A client submitted progress photos.</summary>
    ProgressPhotosSubmitted,

    /// <summary>A client finished a workout.</summary>
    WorkoutFinished,
}
