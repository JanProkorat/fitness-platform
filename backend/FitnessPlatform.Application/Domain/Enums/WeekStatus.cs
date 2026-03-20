namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Publish status of a single week within a nutrition plan.
/// </summary>
public enum WeekStatus
{
    /// <summary>Week is being edited, not yet visible to client.</summary>
    Draft,
    /// <summary>Week is published and visible to client.</summary>
    Published
}
