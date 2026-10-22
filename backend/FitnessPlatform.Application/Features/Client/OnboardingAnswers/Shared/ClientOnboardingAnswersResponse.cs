using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Features.Client.OnboardingAnswers.Shared;

/// <summary>
/// The onboarding answers a client may edit later.
/// </summary>
public class ClientOnboardingAnswersResponse
{
    /// <summary>Primary goal (enum name).</summary>
    public string PrimaryGoal { get; set; } = string.Empty;

    /// <summary>Target weight in kilograms, if set.</summary>
    public decimal? TargetWeightKg { get; set; }

    /// <summary>Desired training frequency (enum name).</summary>
    public string DesiredTrainingFrequency { get; set; } = string.Empty;

    /// <summary>Gym access (enum name).</summary>
    public string GymAccess { get; set; } = string.Empty;

    /// <summary>Injuries or limitations.</summary>
    public List<string> Injuries { get; set; } = [];

    /// <summary>Dietary style (enum name).</summary>
    public string DietaryStyle { get; set; } = string.Empty;

    /// <summary>Food allergies and intolerances.</summary>
    public List<string> Allergies { get; set; } = [];

    /// <summary>Foods the client dislikes.</summary>
    public List<string> Dislikes { get; set; } = [];

    /// <summary>Date of birth.</summary>
    public DateOnly DateOfBirth { get; set; }

    /// <summary>Biological sex (enum name).</summary>
    public string Sex { get; set; } = string.Empty;

    /// <summary>Height in centimeters.</summary>
    public decimal HeightCm { get; set; }

    /// <summary>Type of daily job activity (enum name).</summary>
    public string JobType { get; set; } = string.Empty;

    /// <summary>Average hours of sleep per night.</summary>
    public int SleepHours { get; set; }

    /// <summary>Self-reported stress level (1-5).</summary>
    public int StressLevel { get; set; }

    /// <summary>Current training frequency (enum name).</summary>
    public string CurrentTrainingFrequency { get; set; } = string.Empty;

    /// <summary>Preferred activity types.</summary>
    public List<string> PreferredActivities { get; set; } = [];

    /// <summary>Meals per day (enum name).</summary>
    public string MealsPerDay { get; set; } = string.Empty;

    /// <summary>Eating habits.</summary>
    public List<string> Habits { get; set; } = [];

    /// <summary>Maps the stored onboarding row to the response.</summary>
    public static ClientOnboardingAnswersResponse FromEntity(ClientOnboardingData data) => new()
    {
        PrimaryGoal = data.PrimaryGoal.ToString(),
        TargetWeightKg = data.TargetWeightKg,
        DesiredTrainingFrequency = data.DesiredTrainingFrequency.ToString(),
        GymAccess = data.GymAccess.ToString(),
        Injuries = SplitList(data.Injuries),
        DietaryStyle = data.DietaryStyle.ToString(),
        Allergies = SplitList(data.Allergies),
        Dislikes = [.. data.Dislikes],
        DateOfBirth = DateOnly.FromDateTime(data.DateOfBirth),
        Sex = data.Sex.ToString(),
        HeightCm = data.HeightCm,
        JobType = data.JobType.ToString(),
        SleepHours = data.SleepHours,
        StressLevel = data.StressLevel,
        CurrentTrainingFrequency = data.CurrentTrainingFrequency.ToString(),
        PreferredActivities = SplitList(data.PreferredActivities),
        MealsPerDay = data.MealsPerDay.ToString(),
        Habits = [.. data.Habits],
    };

    private static List<string> SplitList(string joined) =>
        joined.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
}
