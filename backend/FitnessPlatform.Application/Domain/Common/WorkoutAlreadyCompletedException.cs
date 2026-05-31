namespace FitnessPlatform.Application.Domain.Common;

/// <summary>
/// Thrown by <see cref="FitnessPlatform.Application.Infrastructure.Services.WorkoutCompletionService"/>
/// when a MongoDB E11000 duplicate-key error occurs on the partial unique index
/// <c>{ planId, sessionId, completedDate | isCompleted == true }</c>.
/// Callers should surface this as HTTP 409.
/// </summary>
public sealed class WorkoutAlreadyCompletedException : Exception
{
    /// <summary>
    /// Initializes a new instance of <see cref="WorkoutAlreadyCompletedException"/>.
    /// </summary>
    public WorkoutAlreadyCompletedException()
        : base("This session was already completed on the same calendar day by a concurrent request.")
    {
    }

    /// <summary>
    /// Initializes a new instance of <see cref="WorkoutAlreadyCompletedException"/>
    /// with the specified inner exception.
    /// </summary>
    public WorkoutAlreadyCompletedException(Exception inner)
        : base("This session was already completed on the same calendar day by a concurrent request.", inner)
    {
    }
}
