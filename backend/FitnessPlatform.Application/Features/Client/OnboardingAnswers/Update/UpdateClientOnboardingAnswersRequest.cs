namespace FitnessPlatform.Application.Features.Client.OnboardingAnswers.Update;

/// <summary>
/// Partial update of the client's onboarding answers. A null property is left unchanged.
/// </summary>
public class UpdateClientOnboardingAnswersRequest
{
    /// <summary>Primary goal (enum name).</summary>
    public string? PrimaryGoal { get; set; }

    /// <summary>Target weight in kilograms (40-250).</summary>
    public decimal? TargetWeightKg { get; set; }

    /// <summary>Desired training frequency (enum name).</summary>
    public string? DesiredTrainingFrequency { get; set; }

    /// <summary>Gym access (enum name).</summary>
    public string? GymAccess { get; set; }

    /// <summary>Injuries or limitations; replaces the stored list.</summary>
    public List<string>? Injuries { get; set; }

    /// <summary>Dietary style (enum name).</summary>
    public string? DietaryStyle { get; set; }

    /// <summary>Food allergies and intolerances; replaces the stored list.</summary>
    public List<string>? Allergies { get; set; }

    /// <summary>Foods the client dislikes; replaces the stored list.</summary>
    public List<string>? Dislikes { get; set; }

    /// <summary>Date of birth; the client must be 13-100 years old.</summary>
    public DateOnly? DateOfBirth { get; set; }

    /// <summary>Biological sex (enum name).</summary>
    public string? Sex { get; set; }

    /// <summary>Height in centimeters (140-220, one decimal place).</summary>
    public decimal? HeightCm { get; set; }

    /// <summary>Type of daily job activity (enum name).</summary>
    public string? JobType { get; set; }

    /// <summary>Average hours of sleep per night (1-10).</summary>
    public int? SleepHours { get; set; }

    /// <summary>Self-reported stress level (1-5).</summary>
    public int? StressLevel { get; set; }

    /// <summary>Current training frequency over the last four weeks (enum name).</summary>
    public string? CurrentTrainingFrequency { get; set; }

    /// <summary>Preferred activity types; replaces the stored list.</summary>
    public List<string>? PreferredActivities { get; set; }

    /// <summary>Meals per day (enum name).</summary>
    public string? MealsPerDay { get; set; }

    /// <summary>Eating habits; replaces the stored list.</summary>
    public List<string>? Habits { get; set; }
}
