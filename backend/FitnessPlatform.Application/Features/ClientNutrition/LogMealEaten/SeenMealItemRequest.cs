using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;

/// <summary>
/// One meal item as the client saw it when it queued the request.
/// </summary>
public class SeenMealItemRequest
{
    /// <summary>Whether the item is a food or a recipe.</summary>
    public SeenMealItemKind Kind { get; set; }

    /// <summary>Public id of the food or recipe.</summary>
    public Guid RefId { get; set; }

    /// <summary>Display name shown to the client.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Amount shown to the client.</summary>
    public decimal Amount { get; set; }

    /// <summary>Energy shown to the client, in kcal.</summary>
    public decimal Kcal { get; set; }
}
