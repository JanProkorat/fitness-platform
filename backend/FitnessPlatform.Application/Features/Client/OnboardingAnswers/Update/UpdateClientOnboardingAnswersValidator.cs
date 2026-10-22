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
    private const int MaxHabits = 20;
    private const int MaxHabitLength = 60;
    private const int MinAge = 13;
    private const int MaxAge = 100;

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

        RuleFor(x => x.Sex).Must(IsDefinedName<BiologicalSex>)
            .When(x => x.Sex is not null).WithMessage("Unknown sex.");
        RuleFor(x => x.JobType).Must(IsDefinedName<JobType>)
            .When(x => x.JobType is not null).WithMessage("Unknown job type.");
        RuleFor(x => x.CurrentTrainingFrequency).Must(IsDefinedName<CurrentTrainingFrequency>)
            .When(x => x.CurrentTrainingFrequency is not null).WithMessage("Unknown current training frequency.");
        RuleFor(x => x.MealsPerDay).Must(IsDefinedName<MealsPerDay>)
            .When(x => x.MealsPerDay is not null).WithMessage("Unknown meals per day.");

        RuleFor(x => x.HeightCm)
            .InclusiveBetween(140m, 220m)
            .PrecisionScale(5, 1, true)
            .When(x => x.HeightCm.HasValue);
        RuleFor(x => x.SleepHours)
            .InclusiveBetween(1, 10)
            .When(x => x.SleepHours.HasValue);
        RuleFor(x => x.StressLevel)
            .InclusiveBetween(1, 5)
            .When(x => x.StressLevel.HasValue);

        RuleFor(x => x.DateOfBirth)
            .Must(IsPlausibleDateOfBirth)
            .When(x => x.DateOfBirth.HasValue)
            .WithMessage($"Date of birth must be in the past and give an age of {MinAge}-{MaxAge}.");

        AddCommaListRules(x => x.PreferredActivities!, "activity");

        RuleFor(x => x.Habits)
            .Must(items => items!.Count <= MaxHabits)
            .When(x => x.Habits is not null)
            .WithMessage($"At most {MaxHabits} habits are allowed.");
        RuleForEach(x => x.Habits)
            .Must(item => !string.IsNullOrWhiteSpace(item) && item.Trim().Length <= MaxHabitLength)
            .WithMessage($"Each habit must be 1-{MaxHabitLength} characters and not blank.");
    }

    // Strictly before today (UTC) and whole-year age (birthday-adjusted) within the allowed range.
    private static bool IsPlausibleDateOfBirth(DateOnly? dateOfBirth)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (dateOfBirth!.Value >= today)
        {
            return false;
        }

        var age = today.Year - dateOfBirth.Value.Year;

        if (dateOfBirth.Value > today.AddYears(-age))
        {
            age--;
        }

        return age is >= MinAge and <= MaxAge;
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
