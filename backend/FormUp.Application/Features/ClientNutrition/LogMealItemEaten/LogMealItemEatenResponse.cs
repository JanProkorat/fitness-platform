using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Features.ClientNutrition.LogMealItemEaten;

/// <summary>
/// The eaten state of the meal after one of its items was marked eaten.
/// </summary>
public class LogMealItemEatenResponse
{
    /// <summary>The plan meal.</summary>
    public Guid MealId { get; set; }

    /// <summary>The item that was marked.</summary>
    public Guid ItemId { get; set; }

    /// <summary>How much of the meal is eaten now.</summary>
    public MealEatenState EatenState { get; set; }

    /// <summary>Ids of every eaten item of the meal.</summary>
    public List<Guid> EatenItemIds { get; set; } = [];

    /// <summary>When the last item was eaten; null unless every item is eaten.</summary>
    public DateTime? EatenAt { get; set; }
}
