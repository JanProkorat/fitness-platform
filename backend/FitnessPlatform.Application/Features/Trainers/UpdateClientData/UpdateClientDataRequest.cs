namespace FitnessPlatform.Application.Features.Trainers.UpdateClientData;

/// <summary>
/// Request to update a client's profile and nutrition target data.
/// Only non-null fields are updated.
/// </summary>
public class UpdateClientDataRequest
{
    /// <summary>Client profile public ID (route parameter).</summary>
    public Guid ClientId { get; set; }

    // --- Identity fields (#667) — persisted on the client's ApplicationUser,
    // not the ClientProfile. Email doubles as the account's login identifier
    // (UserManager.FindByEmailAsync), so a change here goes through
    // UserManager.SetEmailAsync/SetUserNameAsync for uniqueness enforcement
    // and normalized-field upkeep rather than a direct field assignment. ---
    /// <summary>Client's first name.</summary>
    public string? FirstName { get; set; }
    /// <summary>Client's last name.</summary>
    public string? LastName { get; set; }
    /// <summary>Client's email address (also the login identifier).</summary>
    public string? Email { get; set; }

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
    /// <summary>Meal distribution percentages as JSON.</summary>
    public string? MealDistribution { get; set; }
}
