namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Type of exercise set within a training session.
/// </summary>
public enum SetType
{
    /// <summary>Standard working set.</summary>
    Normal,

    /// <summary>Warm-up set with reduced load.</summary>
    Warmup,

    /// <summary>Drop set with decreasing weight.</summary>
    Dropset,

    /// <summary>Superset paired with another exercise.</summary>
    Superset
}
