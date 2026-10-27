namespace FitnessPlatform.Application.Features.ClientNutrition.AddOffPlanFood;

/// <summary>
/// Request for logging a food eaten outside the plan today.
/// </summary>
public class AddOffPlanFoodRequest
{
    /// <summary>The food's ExternalId.</summary>
    public Guid FoodExternalId { get; set; }

    /// <summary>Amount eaten in grams.</summary>
    public decimal AmountGrams { get; set; }
}
