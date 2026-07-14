using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientMeasurements.AddClientMeasurement;

/// <summary>
/// Validates the <see cref="AddClientMeasurementRequest"/>.
/// </summary>
public class AddClientMeasurementValidator : Validator<AddClientMeasurementRequest>
{
    /// <summary>
    /// Initializes validation rules for a trainer recording a client's body measurement.
    /// </summary>
    public AddClientMeasurementValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty();

        RuleFor(x => x.MeasuredAt)
            .NotEmpty()
            .WithMessage("MeasuredAt is required.")
            .LessThanOrEqualTo(_ => DateTime.UtcNow.AddMinutes(1))
            .WithMessage("MeasuredAt cannot be in the future.");

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

        RuleFor(x => x)
            .Must(HaveAtLeastOneMeasurementValue)
            .WithMessage("At least one measurement value must be provided.");
    }

    private static bool HaveAtLeastOneMeasurementValue(AddClientMeasurementRequest req) =>
        req.WeightKg.HasValue
        || req.BodyFatPercentage.HasValue
        || req.ChestCm.HasValue
        || req.WaistCm.HasValue
        || req.HipsCm.HasValue
        || req.BicepsCm.HasValue
        || req.ThighsCm.HasValue;
}
