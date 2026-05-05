namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Defines how performance in an exercise is measured.
/// </summary>
public enum MovementType
{
    /// <summary>
    /// Repetitions — performance is counted by number of reps.
    /// </summary>
    Reps,

    /// <summary>
    /// Time — performance is measured in seconds held or elapsed.
    /// </summary>
    Time,

    /// <summary>
    /// Distance — performance is measured in meters.
    /// </summary>
    Distance,

    /// <summary>
    /// Reps For Time — performance is the time taken to complete a target rep count.
    /// </summary>
    RepsForTime
}
