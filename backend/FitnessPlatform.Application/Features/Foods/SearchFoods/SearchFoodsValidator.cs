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
    /// The maximum number of tags a single search request may filter by.
    /// </summary>
    private const int MaxTags = 20;

    /// <summary>
    /// The maximum length of a single filter tag.
    /// </summary>
    private const int MaxTagLength = 40;

    /// <summary>
    /// The maximum number of categories a single search request may filter by — the number of
    /// <see cref="FoodCategory"/> members, since supplying more is necessarily a duplicate.
    /// </summary>
    private static readonly int MaxCategories = Enum.GetValues<FoodCategory>().Length;

    /// <summary>
    /// Initializes validation rules for food search.
    /// </summary>
    public SearchFoodsValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);

        RuleFor(x => x.Tags)
            .Must(tags => tags.Count <= MaxTags)
            .WithMessage($"At most {MaxTags} tags may be supplied.");

        RuleForEach(x => x.Tags)
            .NotEmpty()
            .WithMessage("A filter tag must not be blank.")
            .MaximumLength(MaxTagLength)
            .WithMessage($"A filter tag must be at most {MaxTagLength} characters.");

        RuleFor(x => x.Categories)
            .Must(categories => categories.Count <= MaxCategories)
            .WithMessage($"At most {MaxCategories} categories may be supplied.");

        RuleForEach(x => x.Categories)
            .IsInEnum();
    }
}
