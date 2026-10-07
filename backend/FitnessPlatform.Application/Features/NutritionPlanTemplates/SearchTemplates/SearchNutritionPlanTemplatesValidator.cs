using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.SearchTemplates;

/// <summary>
/// Validates <see cref="SearchNutritionPlanTemplatesRequest"/>. Paging and search-term length are
/// validated by <c>LibrarySearchHelper</c>; this covers the template-specific filters.
/// </summary>
public class SearchNutritionPlanTemplatesValidator : Validator<SearchNutritionPlanTemplatesRequest>
{
    /// <summary>
    /// Initializes validation rules for nutrition plan template search.
    /// </summary>
    public SearchNutritionPlanTemplatesValidator()
    {
        RuleFor(x => x.MealsPerDay)
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.MealsPerDay.HasValue);
    }
}
