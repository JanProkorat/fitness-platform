using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientPhotos.GetMyPhotos;

/// <summary>
/// Validation rules for <see cref="GetMyPhotosRequest"/>.
/// </summary>
public class GetMyPhotosValidator : Validator<GetMyPhotosRequest>
{
    /// <summary>
    /// Initializes the validation rules.
    /// </summary>
    public GetMyPhotosValidator()
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
