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
}
