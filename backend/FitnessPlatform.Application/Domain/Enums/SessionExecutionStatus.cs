namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Lifecycle status of a <see cref="Documents.SessionExecution"/>.
/// </summary>
public enum SessionExecutionStatus
{
    /// <summary>
    /// Some, but not all, exercises/sections of the session are complete — or a live
    /// workout is still in progress (draft, <c>Performance.CompletedAt</c> is null).
    /// </summary>
    Partial,

    /// <summary>
    /// Every section of the session is complete: either a live workout was finished
    /// (<c>Performance.CompletedAt</c> set), or every exercise/section was marked
    /// complete via the lightweight checkbox flags.
    /// </summary>
    Completed
}
