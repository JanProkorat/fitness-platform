namespace FitnessPlatform.Application.Features.Trainers.UpdateClientData;

/// <summary>
/// Request to update a client's profile and nutrition target data.
/// Only non-null fields are updated.
/// </summary>
public class UpdateClientDataRequest
{
    /// <summary>Client profile public ID (route parameter).</summary>
    public Guid ClientId { get; set; }

    // --- Profile fields ---
    /// <summary>Weight in kg.</summary>
    public decimal? WeightKg { get; set; }
    /// <summary>Height in cm.</summary>
    public decimal? HeightCm { get; set; }
    /// <summary>Age in years (converted to DateOfBirth).</summary>
    public int? Age { get; set; }
    /// <summary>Biological sex.</summary>
    public string? Sex { get; set; }

    // --- Nutrition targets ---
    /// <summary>Activity level used for calculation.</summary>
    public string? DerivedActivityLevel { get; set; }
    /// <summary>Nutrition goal used for calculation.</summary>
    public string? DerivedNutritionGoal { get; set; }
    /// <summary>BMR in kcal/day.</summary>
    public decimal? Bmr { get; set; }
    /// <summary>TDEE in kcal/day.</summary>
    public decimal? Tdee { get; set; }
    /// <summary>Adjusted daily calories.</summary>
    public decimal? AdjustedKcal { get; set; }
    /// <summary>Daily protein grams.</summary>
    public decimal? ProteinGrams { get; set; }
    /// <summary>Daily carbs grams.</summary>
    public decimal? CarbsGrams { get; set; }
    /// <summary>Daily fat grams.</summary>
    public decimal? FatGrams { get; set; }
}
