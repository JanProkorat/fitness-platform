using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Features.ClientNutrition.UnlogMealItemEaten;

/// <summary>
/// The eaten state of the meal after one of its items was unmarked.
/// </summary>
public class UnlogMealItemEatenResponse
{
    /// <summary>The plan meal.</summary>
    public Guid MealId { get; set; }

    /// <summary>The item that was unmarked.</summary>
    public Guid ItemId { get; set; }

    /// <summary>How much of the meal is eaten now.</summary>
    public MealEatenState EatenState { get; set; }

    /// <summary>Ids of every eaten item of the meal.</summary>
    public List<Guid> EatenItemIds { get; set; } = [];

    /// <summary>Always null: a meal with an unmarked item is not fully eaten.</summary>
    public DateTime? EatenAt { get; set; }
}
