using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Trainers.UpdateClientData;

/// <summary>
/// Validates the update client data request.
/// </summary>
public class UpdateClientDataValidator : Validator<UpdateClientDataRequest>
{
    /// <inheritdoc />
    public UpdateClientDataValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(50).When(x => x.FirstName != null);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(50).When(x => x.LastName != null);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(100).When(x => x.Email != null);
        RuleFor(x => x.WeightKg).InclusiveBetween(30, 300).When(x => x.WeightKg.HasValue);
        RuleFor(x => x.HeightCm).InclusiveBetween(100, 250).When(x => x.HeightCm.HasValue);
        RuleFor(x => x.Age).InclusiveBetween(10, 120).When(x => x.Age.HasValue);
        RuleFor(x => x.Sex).Must(v => Enum.TryParse<BiologicalSex>(v, true, out _)).When(x => x.Sex != null);
        RuleFor(x => x.DerivedActivityLevel).Must(v => Enum.TryParse<ActivityLevel>(v, true, out _)).When(x => x.DerivedActivityLevel != null);
        RuleFor(x => x.DerivedNutritionGoal).Must(v => Enum.TryParse<NutritionGoal>(v, true, out _)).When(x => x.DerivedNutritionGoal != null);
        RuleFor(x => x.Bmr).GreaterThan(0).When(x => x.Bmr.HasValue);
        RuleFor(x => x.Tdee).GreaterThan(0).When(x => x.Tdee.HasValue);
        RuleFor(x => x.AdjustedKcal).GreaterThan(0).When(x => x.AdjustedKcal.HasValue);
        RuleFor(x => x.ProteinGrams).GreaterThanOrEqualTo(0).When(x => x.ProteinGrams.HasValue);
        RuleFor(x => x.CarbsGrams).GreaterThanOrEqualTo(0).When(x => x.CarbsGrams.HasValue);
        RuleFor(x => x.FatGrams).GreaterThanOrEqualTo(0).When(x => x.FatGrams.HasValue);
    }
}
