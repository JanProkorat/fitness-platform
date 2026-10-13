namespace FitnessPlatform.Application.Features.Trainers.UpdateClientNutritionProfile;

/// <summary>
/// The client's nutrition profile after the update.
/// </summary>
public class UpdateClientNutritionProfileResponse
{
    /// <summary>Stored dislikes.</summary>
    public List<string> Dislikes { get; set; } = [];

    /// <summary>Stored habits.</summary>
    public List<string> Habits { get; set; } = [];

    /// <summary>Stored allergies.</summary>
    public List<string> Allergies { get; set; } = [];

    /// <summary>Stored fibre target in grams; null when none is set.</summary>
    public decimal? FibreGrams { get; set; }
}
