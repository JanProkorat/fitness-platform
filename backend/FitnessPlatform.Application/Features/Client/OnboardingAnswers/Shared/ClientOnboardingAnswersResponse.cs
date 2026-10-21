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
    };

    private static List<string> SplitList(string joined) =>
        joined.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
}
