using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientMeasurements.GetMeasurements;

/// <summary>
/// Validates the <see cref="GetMeasurementsRequest"/> pagination parameters.
/// </summary>
public class GetMeasurementsValidator : Validator<GetMeasurementsRequest>
{
    /// <summary>
    /// Initializes validation rules for listing body measurements.
    /// </summary>
    public GetMeasurementsValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);
    }
}
