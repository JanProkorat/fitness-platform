using FastEndpoints;
using FitnessPlatform.Application.Domain.Enums;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Foods.SearchFoods;

/// <summary>
/// Validates the <see cref="SearchFoodsRequest"/>.
/// </summary>
public class SearchFoodsValidator : Validator<SearchFoodsRequest>
{
    /// <summary>
    /// The maximum number of tag ids a single search request may filter by.
    /// </summary>
    private const int MaxTags = 20;

    /// <summary>
    /// The maximum number of categories a single search request may filter by — the number of
    /// <see cref="FoodCategory"/> members, since supplying more is necessarily a duplicate.
    /// </summary>
    private static readonly int MaxCategories = Enum.GetValues<FoodCategory>().Length;

    /// <summary>
    /// The maximum number of owner values a single search request may filter by — the number of
    /// <see cref="FoodOwnerFilter"/> members, since supplying more is necessarily a duplicate.
    /// </summary>
    private static readonly int MaxOwners = Enum.GetValues<FoodOwnerFilter>().Length;

    /// <summary>
    /// Initializes validation rules for food search.
    /// </summary>
    public SearchFoodsValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);

        RuleFor(x => x.TagIds)
            .Must(tagIds => tagIds.Count <= MaxTags)
            .WithMessage($"At most {MaxTags} tag ids may be supplied.");

        RuleForEach(x => x.TagIds)
            .NotEqual(Guid.Empty)
            .WithMessage("A filter tag id must not be empty.");

        RuleFor(x => x.Categories)
            .Must(categories => categories.Count <= MaxCategories)
            .WithMessage($"At most {MaxCategories} categories may be supplied.");

        RuleForEach(x => x.Categories)
            .IsInEnum();

        RuleFor(x => x.Owners)
            .Must(owners => owners.Count <= MaxOwners)
            .WithMessage($"At most {MaxOwners} owner values may be supplied.");

        RuleForEach(x => x.Owners)
            .IsInEnum();

        RuleFor(x => x.SortBy)
            .IsInEnum();

        RuleFor(x => x.SortDir)
            .IsInEnum();
    }
}
