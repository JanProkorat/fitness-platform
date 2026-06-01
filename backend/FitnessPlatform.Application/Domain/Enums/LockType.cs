namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Describes the purpose/mode of a session lock.
/// </summary>
public enum LockType
{
    /// <summary>
    /// The trainer has explicitly unlocked a session for editing.
    /// </summary>
    Editing,

    /// <summary>
    /// The client has started an active workout for this session.
    /// </summary>
    Live
}
