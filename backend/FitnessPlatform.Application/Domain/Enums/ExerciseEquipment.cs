namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Equipment required for an exercise.
/// </summary>
public enum ExerciseEquipment
{
    /// <summary>No equipment needed (žádné).</summary>
    None,

    /// <summary>Dumbbells (činky).</summary>
    Dumbbells,

    /// <summary>Barbell (osa).</summary>
    Barbell,

    /// <summary>Machine (stroj).</summary>
    Machine,

    /// <summary>TRX suspension trainer.</summary>
    TRX,

    /// <summary>Kettlebell.</summary>
    Kettlebell,

    /// <summary>Bodyweight only (vlastní váha).</summary>
    Bodyweight
}
