using FastEndpoints;
using FitnessPlatform.Application.Domain.Enums;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Client.OnboardingAnswers.Update;

/// <summary>
/// Validates the <see cref="UpdateClientOnboardingAnswersRequest"/>.
/// </summary>
internal sealed class UpdateClientOnboardingAnswersValidator : Validator<UpdateClientOnboardingAnswersRequest>
{
    private const int MaxListLength = 200;
    private const int MaxDislikes = 20;
    private const int MaxDislikeLength = 60;

    /// <summary>
    /// Initializes validation rules for editing onboarding answers.
    /// </summary>
    public UpdateClientOnboardingAnswersValidator()
    {
        RuleFor(x => x.PrimaryGoal).Must(IsDefinedName<PrimaryGoal>)
            .When(x => x.PrimaryGoal is not null).WithMessage("Unknown primary goal.");
        RuleFor(x => x.DesiredTrainingFrequency).Must(IsDefinedName<DesiredTrainingFrequency>)
            .When(x => x.DesiredTrainingFrequency is not null).WithMessage("Unknown training frequency.");
        RuleFor(x => x.GymAccess).Must(IsDefinedName<GymAccess>)
            .When(x => x.GymAccess is not null).WithMessage("Unknown gym access.");
        RuleFor(x => x.DietaryStyle).Must(IsDefinedName<DietaryStyle>)
            .When(x => x.DietaryStyle is not null).WithMessage("Unknown dietary style.");

        RuleFor(x => x.TargetWeightKg)
            .InclusiveBetween(40m, 250m)
            .When(x => x.TargetWeightKg.HasValue);

        AddCommaListRules(x => x.Injuries!, "injury");
        AddCommaListRules(x => x.Allergies!, "allergy");

        RuleFor(x => x.Dislikes)
            .Must(items => items!.Count <= MaxDislikes)
            .When(x => x.Dislikes is not null)
            .WithMessage($"At most {MaxDislikes} dislikes are allowed.");
        RuleForEach(x => x.Dislikes)
            .Must(item => !string.IsNullOrWhiteSpace(item) && item.Trim().Length <= MaxDislikeLength)
            .WithMessage($"Each dislike must be 1-{MaxDislikeLength} characters and not blank.");
    }

    private void AddCommaListRules(
        System.Linq.Expressions.Expression<Func<UpdateClientOnboardingAnswersRequest, IEnumerable<string>>> selector,
        string noun)
    {
        var read = selector.Compile();

        RuleFor(selector)
            .Must(items => string.Join(",", items!.Select(item => item?.Trim())).Length <= MaxListLength)
            .When(x => read(x) is not null)
            .WithMessage($"The {noun} list must not exceed {MaxListLength} characters in total.");
        RuleForEach(selector)
            .Must(item => !string.IsNullOrWhiteSpace(item) && !item.Contains(','))
            .WithMessage($"Each {noun} must be non-blank and must not contain a comma.");
    }

    // TryParse alone accepts numeric strings such as "99", so membership is checked too.
    private static bool IsDefinedName<TEnum>(string? value)
        where TEnum : struct, Enum =>
        Enum.TryParse<TEnum>(value, true, out var parsed) && Enum.IsDefined(parsed);
}
