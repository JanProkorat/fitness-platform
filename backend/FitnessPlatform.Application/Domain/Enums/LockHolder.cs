namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Identifies which party currently holds a session lock.
/// </summary>
public enum LockHolder
{
    /// <summary>
    /// A trainer or nutritionist holds the lock (Editing state).
    /// </summary>
    Coach,

    /// <summary>
    /// The client holds the lock (Live/in-progress state).
    /// </summary>
    Client
}
