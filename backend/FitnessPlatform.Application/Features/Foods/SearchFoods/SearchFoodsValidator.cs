using FastEndpoints;
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
    }
}
