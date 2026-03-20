namespace FitnessPlatform.Application.Features.Client.SubmitOnboarding;

/// <summary>
/// Request model for the client onboarding questionnaire submission.
/// </summary>
public class SubmitOnboardingRequest
{
    /// <summary>Client's age in years (converted to DateOfBirth server-side).</summary>
    public int Age { get; set; }
    /// <summary>Biological sex (string, parsed to BiologicalSex enum).</summary>
    public string Sex { get; set; } = string.Empty;
    /// <summary>Height in centimeters.</summary>
    public decimal HeightCm { get; set; }
    /// <summary>Current weight in kilograms.</summary>
    public decimal WeightKg { get; set; }
    /// <summary>Target weight in kilograms (optional).</summary>
    public decimal? TargetWeightKg { get; set; }
    /// <summary>Body constitution type (string, parsed to BodyType enum).</summary>
    public string BodyType { get; set; } = string.Empty;
    /// <summary>Primary fitness goal.</summary>
    public string PrimaryGoal { get; set; } = string.Empty;
    /// <summary>Desired time horizon.</summary>
    public string TimeHorizon { get; set; } = string.Empty;
    /// <summary>Job activity type.</summary>
    public string JobType { get; set; } = string.Empty;
    /// <summary>Average sleep hours per night (4-10).</summary>
    public int SleepHours { get; set; }
    /// <summary>Self-reported stress level (1-5).</summary>
    public int StressLevel { get; set; }
    /// <summary>Current training frequency.</summary>
    public string CurrentTrainingFrequency { get; set; } = string.Empty;
    /// <summary>Desired training frequency.</summary>
    public string DesiredTrainingFrequency { get; set; } = string.Empty;
    /// <summary>Self-rated fitness level (1-10).</summary>
    public int FitnessRating { get; set; }
    /// <summary>Gym access level (optional).</summary>
    public string? GymAccess { get; set; }
    /// <summary>Preferred activity types.</summary>
    public List<string> PreferredActivities { get; set; } = [];
    /// <summary>Physical injuries or limitations.</summary>
    public List<string> Injuries { get; set; } = [];
    /// <summary>Meals per day.</summary>
    public string MealsPerDay { get; set; } = string.Empty;
    /// <summary>Dietary style.</summary>
    public string DietaryStyle { get; set; } = string.Empty;
    /// <summary>Food allergies/intolerances.</summary>
    public List<string> Allergies { get; set; } = [];
    /// <summary>Self-rated diet quality (1-5, optional).</summary>
    public int? DietRating { get; set; }
    /// <summary>Prior plan experience.</summary>
    public string PlanExperience { get; set; } = string.Empty;
    /// <summary>Past blockers to fitness progress.</summary>
    public List<string> PastBlockers { get; set; } = [];
    /// <summary>Primary motivation source.</summary>
    public string PrimaryMotivation { get; set; } = string.Empty;
}
