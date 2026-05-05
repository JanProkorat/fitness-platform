using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.SectionTemplates.ListSectionTemplates;

/// <summary>
/// Validates <see cref="ListSectionTemplatesRequest"/>.
/// </summary>
public class ListSectionTemplatesValidator : Validator<ListSectionTemplatesRequest>
{
    /// <summary>
    /// Initializes pagination validation rules.
    /// </summary>
    public ListSectionTemplatesValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("Page must be >= 1.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, 200).WithMessage("PageSize must be between 1 and 200.");
    }
}
