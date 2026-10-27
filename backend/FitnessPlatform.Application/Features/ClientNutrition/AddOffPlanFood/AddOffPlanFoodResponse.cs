using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.ClientNutrition.AddOffPlanFood;

/// <summary>
/// The off-plan food entry that was added, with server-computed macros.
/// </summary>
public class AddOffPlanFoodResponse
{
    /// <summary>Identifier of the entry — pass to the remove endpoint.</summary>
    public Guid EntryId { get; set; }

    /// <summary>The food's ExternalId.</summary>
    public Guid FoodExternalId { get; set; }

    /// <summary>Food name.</summary>
    public string FoodName { get; set; } = string.Empty;

    /// <summary>Amount eaten in grams.</summary>
    public decimal AmountGrams { get; set; }

    /// <summary>Kilocalories for the eaten amount.</summary>
    public decimal Kcal { get; set; }

    /// <summary>Protein in grams.</summary>
    public decimal Protein { get; set; }

    /// <summary>Carbohydrates in grams.</summary>
    public decimal Carbs { get; set; }

    /// <summary>Fat in grams.</summary>
    public decimal Fat { get; set; }

    /// <summary>Fiber in grams.</summary>
    public decimal Fiber { get; set; }

    /// <summary>UTC time the entry was added.</summary>
    public DateTime LoggedAt { get; set; }

    /// <summary>Maps the stored entry to the response.</summary>
    public static AddOffPlanFoodResponse FromDocument(OffPlanFoodEntry entry) => new()
    {
        EntryId = entry.EntryId,
        FoodExternalId = entry.FoodExternalId,
        FoodName = entry.FoodName,
        AmountGrams = entry.AmountGrams,
        Kcal = entry.Kcal,
        Protein = entry.Protein,
        Carbs = entry.Carbs,
        Fat = entry.Fat,
        Fiber = entry.Fiber,
        LoggedAt = entry.LoggedAt,
    };
}
