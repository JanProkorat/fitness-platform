using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientPhotos.GetTrainerClientPhotos;

/// <summary>
/// Validation rules for <see cref="GetTrainerClientPhotosRequest"/>.
/// </summary>
public class GetTrainerClientPhotosValidator : Validator<GetTrainerClientPhotosRequest>
{
    /// <summary>
    /// Initializes the validation rules.
    /// </summary>
    public GetTrainerClientPhotosValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithErrorCode("OUT_OF_RANGE");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100)
            .WithErrorCode("OUT_OF_RANGE");

        RuleFor(x => x.To)
            .GreaterThanOrEqualTo(x => x.From!.Value)
            .When(x => x.From.HasValue && x.To.HasValue)
            .WithErrorCode("OUT_OF_RANGE");
    }
}
