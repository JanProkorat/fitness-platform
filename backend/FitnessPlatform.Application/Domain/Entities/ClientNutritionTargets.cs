using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Stores the computed nutrition targets derived from a client's onboarding
/// answers (one-to-one with <see cref="ClientOnboardingData"/>).
/// </summary>
public class ClientNutritionTargets : TimestampableEntity
{
    /// <summary>Foreign key to the associated <see cref="ClientOnboardingData"/>.</summary>
    public long ClientOnboardingDataId { get; set; }

    /// <summary>Derived activity level used for TDEE calculation.</summary>
    public ActivityLevel DerivedActivityLevel { get; set; }

    /// <summary>Derived nutrition goal used for caloric adjustment.</summary>
    public NutritionGoal DerivedNutritionGoal { get; set; }

    /// <summary>Basal Metabolic Rate (Mifflin-St Jeor), kcal/day.</summary>
    public decimal Bmr { get; set; }

    /// <summary>Total Daily Energy Expenditure, kcal/day.</summary>
    public decimal Tdee { get; set; }

    /// <summary>Goal-adjusted daily calories.</summary>
    public decimal AdjustedKcal { get; set; }

    /// <summary>Daily protein target in grams.</summary>
    public decimal ProteinGrams { get; set; }

    /// <summary>Daily carbohydrate target in grams.</summary>
    public decimal CarbsGrams { get; set; }

    /// <summary>Daily fat target in grams.</summary>
    public decimal FatGrams { get; set; }

    /// <summary>Meal distribution percentages as JSON (e.g. {"breakfast":25,"snack1":10,"lunch":30,"snack2":10,"dinner":25}).</summary>
    [MaxLength(500)]
    public string? MealDistribution { get; set; }

    // --- Navigation ---
    /// <summary>Navigation property to the associated onboarding data row.</summary>
    public ClientOnboardingData ClientOnboardingData { get; set; } = null!;
}
