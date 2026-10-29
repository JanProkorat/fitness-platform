using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;

/// <summary>
/// Result of logging a meal as eaten. Always returned with 201, also when the action collided
/// with a plan change (the coach is told separately).
/// </summary>
public class LogMealEatenResponse
{
    /// <summary>Human-readable confirmation.</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>False only when the meal is no longer in the plan, so no meal log was written.</summary>
    public bool MealLogged { get; set; } = true;

    /// <summary>True when the action collided with a plan change the coach made.</summary>
    public bool SyncConflict { get; set; }

    /// <summary>Why it collided; null when <see cref="SyncConflict"/> is false.</summary>
    public OfflineSyncConflictKind? SyncConflictKind { get; set; }

    /// <summary>The confirmation returned for a normal, conflict-free log.</summary>
    public const string LoggedMessage = "Meal logged successfully.";

    /// <summary>The confirmation returned when the meal was removed from the plan.</summary>
    public const string RemovedMessage = "Meal is no longer in your plan; your action was recorded for your coach.";

    /// <summary>Builds the response for a recorded conflict, or the plain one when there is none.</summary>
    public static LogMealEatenResponse FromConflict(OfflineSyncConflictKind? kind, bool mealLogged) => new()
    {
        Message = mealLogged ? LoggedMessage : RemovedMessage,
        MealLogged = mealLogged,
        SyncConflict = kind is not null,
        SyncConflictKind = kind,
    };
}
