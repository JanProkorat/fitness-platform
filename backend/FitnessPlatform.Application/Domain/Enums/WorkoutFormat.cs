namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Defines the workout format / scoring methodology for a training session or exercise.
/// </summary>
public enum WorkoutFormat
{
    /// <summary>
    /// Standard sets-and-reps training — no time cap or interval structure.
    /// </summary>
    Standard,

    /// <summary>
    /// For Time — complete a defined amount of work as fast as possible, with an optional time cap.
    /// </summary>
    ForTime,

    /// <summary>
    /// As Many Rounds/Reps As Possible — accumulate maximum work within a fixed time cap.
    /// </summary>
    AMRAP,

    /// <summary>
    /// Every Minute On the Minute — perform a fixed amount of work at the start of each interval.
    /// </summary>
    EMOM,

    /// <summary>
    /// Tabata — alternating work and rest intervals for a fixed number of rounds.
    /// </summary>
    Tabata
}
