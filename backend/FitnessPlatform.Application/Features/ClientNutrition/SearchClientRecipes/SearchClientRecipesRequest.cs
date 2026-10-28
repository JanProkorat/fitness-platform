using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientNutrition.SearchClientRecipes;

/// <summary>
/// Query for the client's recipe list.
/// </summary>
public class SearchClientRecipesRequest
{
    /// <summary>Page number (1-based). Defaults to 1.</summary>
    public int Page { get; set; } = 1;

    /// <summary>Items per page (1-100). Defaults to 20.</summary>
    public int PageSize { get; set; } = 20;

    /// <summary>Only recipes used in this plan (the caller's own, Active or Completed).</summary>
    public Guid? PlanId { get; set; }

    /// <summary>Only recipes planned under this meal kind.</summary>
    public MealKind? MealType { get; set; }
}
