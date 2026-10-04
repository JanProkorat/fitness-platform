using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.GetClients;

/// <summary>
/// Validates the <see cref="GetClientsRequest"/>.
/// </summary>
public class GetClientsValidator : Validator<GetClientsRequest>
{
    /// <summary>
    /// The maximum number of tag ids a single request may filter by.
    /// </summary>
    private const int MaxTagIds = 20;

    /// <summary>
    /// Initializes validation rules for listing a trainer's clients.
    /// </summary>
    public GetClientsValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);

        RuleFor(x => x.Status)
            .IsInEnum()
            .When(x => x.Status.HasValue);

        RuleFor(x => x.Filter)
            .IsInEnum()
            .When(x => x.Filter.HasValue);

        RuleFor(x => x.TagIds)
            .Must(tagIds => tagIds.Count <= MaxTagIds)
            .WithMessage($"At most {MaxTagIds} tag ids may be supplied.");
    }
}
