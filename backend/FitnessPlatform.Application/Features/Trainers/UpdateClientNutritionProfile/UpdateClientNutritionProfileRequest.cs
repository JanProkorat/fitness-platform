namespace FitnessPlatform.Application.Features.Trainers.UpdateClientNutritionProfile;

/// <summary>
/// Request for editing a client's nutrition profile (dislikes, habits, allergies, fibre target).
/// </summary>
public class UpdateClientNutritionProfileRequest
{
    /// <summary>Route parameter — the client's public id.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Foods the client dislikes. Replaces the stored list. At most 20 items of 1-60 characters.</summary>
    public List<string> Dislikes { get; set; } = [];

    /// <summary>Eating habits. Replaces the stored list. At most 20 items of 1-60 characters.</summary>
    public List<string> Habits { get; set; } = [];

    /// <summary>Food allergies and intolerances. Replaces the stored list; items must not contain commas.</summary>
    public List<string> Allergies { get; set; } = [];

    /// <summary>Daily fibre target in grams (0-150); null leaves the stored target untouched.</summary>
    public decimal? FibreGrams { get; set; }
}
