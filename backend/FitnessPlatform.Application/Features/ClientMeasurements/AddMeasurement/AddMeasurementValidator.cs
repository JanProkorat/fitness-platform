using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientMeasurements.AddMeasurement;

/// <summary>
/// Validates the <see cref="AddMeasurementRequest"/>.
/// </summary>
public class AddMeasurementValidator : Validator<AddMeasurementRequest>
{
    /// <summary>
    /// Initializes validation rules for adding a body measurement.
    /// </summary>
    public AddMeasurementValidator()
    {
        RuleFor(x => x.MeasuredAt)
            .NotEmpty()
            .WithMessage("MeasuredAt is required.");

        RuleFor(x => x.Notes)
            .MaximumLength(500);

        RuleFor(x => x.WeightKg)
            .GreaterThan(0)
            .When(x => x.WeightKg.HasValue);

        RuleFor(x => x.BodyFatPercentage)
            .GreaterThan(0)
            .When(x => x.BodyFatPercentage.HasValue);

        RuleFor(x => x.ChestCm)
            .GreaterThan(0)
            .When(x => x.ChestCm.HasValue);

        RuleFor(x => x.WaistCm)
            .GreaterThan(0)
            .When(x => x.WaistCm.HasValue);

        RuleFor(x => x.HipsCm)
            .GreaterThan(0)
            .When(x => x.HipsCm.HasValue);

        RuleFor(x => x.BicepsCm)
            .GreaterThan(0)
            .When(x => x.BicepsCm.HasValue);

        RuleFor(x => x.ThighsCm)
            .GreaterThan(0)
            .When(x => x.ThighsCm.HasValue);
    }
}
