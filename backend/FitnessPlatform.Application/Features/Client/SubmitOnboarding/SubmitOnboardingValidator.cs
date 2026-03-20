using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Client.SubmitOnboarding;

/// <summary>
/// Validates the onboarding questionnaire submission.
/// </summary>
public class SubmitOnboardingValidator : Validator<SubmitOnboardingRequest>
{
    /// <inheritdoc />
    public SubmitOnboardingValidator()
    {
        RuleFor(x => x.Age).InclusiveBetween(15, 80);
        RuleFor(x => x.Sex).NotEmpty().Must(v => Enum.TryParse<BiologicalSex>(v, true, out _));
        RuleFor(x => x.HeightCm).InclusiveBetween(140, 220);
        RuleFor(x => x.WeightKg).InclusiveBetween(40, 250);
        RuleFor(x => x.TargetWeightKg).InclusiveBetween(40, 250).When(x => x.TargetWeightKg.HasValue);
        RuleFor(x => x.BodyType).NotEmpty().Must(v => Enum.TryParse<BodyType>(v, true, out _));
        RuleFor(x => x.PrimaryGoal).NotEmpty().Must(v => Enum.TryParse<PrimaryGoal>(v, true, out _));
        RuleFor(x => x.TimeHorizon).NotEmpty().Must(v => Enum.TryParse<TimeHorizon>(v, true, out _));
        RuleFor(x => x.JobType).NotEmpty().Must(v => Enum.TryParse<JobType>(v, true, out _));
        RuleFor(x => x.SleepHours).InclusiveBetween(1, 10);
        RuleFor(x => x.StressLevel).InclusiveBetween(1, 5);
        RuleFor(x => x.CurrentTrainingFrequency).NotEmpty().Must(v => Enum.TryParse<CurrentTrainingFrequency>(v, true, out _));
        RuleFor(x => x.DesiredTrainingFrequency).NotEmpty().Must(v => Enum.TryParse<DesiredTrainingFrequency>(v, true, out _));
        RuleFor(x => x.FitnessRating).InclusiveBetween(1, 10);
        RuleFor(x => x.GymAccess).Must(v => v == null || Enum.TryParse<GymAccess>(v, true, out _)).When(x => x.GymAccess != null);
        RuleFor(x => x.MealsPerDay).NotEmpty().Must(v => Enum.TryParse<MealsPerDay>(v, true, out _));
        RuleFor(x => x.DietaryStyle).NotEmpty().MaximumLength(100);
        RuleFor(x => x.DietRating).InclusiveBetween(1, 5).When(x => x.DietRating.HasValue);
        RuleFor(x => x.PlanExperience).NotEmpty().Must(v => Enum.TryParse<PlanExperience>(v, true, out _));
        RuleFor(x => x.PrimaryMotivation).NotEmpty().Must(v => Enum.TryParse<PrimaryMotivation>(v, true, out _));
    }
}
