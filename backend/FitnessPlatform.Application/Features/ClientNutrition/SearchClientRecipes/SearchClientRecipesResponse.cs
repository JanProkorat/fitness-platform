using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientNutrition.SearchClientRecipes;

/// <summary>
/// One page of (plan, recipe) items. The total across all pages is in the <c>X-Total-Count</c> header.
/// </summary>
public class SearchClientRecipesResponse
{
    /// <summary>Items on this page, newest plan first.</summary>
    public List<ClientRecipeListItem> Items { get; set; } = [];
}

/// <summary>
/// A recipe as used in one of the client's plans.
/// </summary>
public class ClientRecipeListItem
{
    /// <summary>The recipe's ExternalId — pass to <c>GET /client/recipes/{RecipeId}</c>.</summary>
    public Guid RecipeId { get; set; }

    /// <summary>Recipe name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Meal kinds the recipe is planned under in this plan (published weeks).</summary>
    public List<MealKind> MealKinds { get; set; } = [];

    /// <summary>The recipe's own meal-type tags, as stored on the recipe.</summary>
    public List<string> MealTypes { get; set; } = [];

    /// <summary>Kilocalories per serving.</summary>
    public decimal Kcal { get; set; }

    /// <summary>Protein in grams per serving.</summary>
    public decimal Protein { get; set; }

    /// <summary>Preparation time in minutes, when known.</summary>
    public int? PrepTimeMinutes { get; set; }

    /// <summary>Recipe image URL, when the recipe has one.</summary>
    public string? ImageUrl { get; set; }

    /// <summary>The plan's ExternalId.</summary>
    public Guid PlanId { get; set; }

    /// <summary>The plan's name.</summary>
    public string PlanName { get; set; } = string.Empty;

    /// <summary>Display name of the nutritionist who wrote the plan.</summary>
    public string NutritionistName { get; set; } = string.Empty;

    /// <summary>First day of the plan, when scheduled.</summary>
    public DateTime? StartDate { get; set; }

    /// <summary>Last day of the plan, when scheduled.</summary>
    public DateTime? EndDate { get; set; }

    /// <summary>True when this is the plan running today.</summary>
    public bool IsCurrentPlan { get; set; }

    /// <summary>True when the plan is current and the recipe is in today's week.</summary>
    public bool IsThisWeek { get; set; }
}
