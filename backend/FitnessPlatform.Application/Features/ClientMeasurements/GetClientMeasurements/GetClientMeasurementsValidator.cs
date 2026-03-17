using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientMeasurements.GetClientMeasurements;

/// <summary>
/// Validates the <see cref="GetClientMeasurementsRequest"/> pagination parameters.
/// </summary>
public class GetClientMeasurementsValidator : Validator<GetClientMeasurementsRequest>
{
    /// <summary>
    /// Initializes validation rules for retrieving a client's body measurements.
    /// </summary>
    public GetClientMeasurementsValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty();

        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);
    }
}
