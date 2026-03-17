namespace FitnessPlatform.Application.Features.Trainers.GetTrainerProfile;

/// <summary>
/// Response model for the trainer's own profile data.
/// </summary>
public class GetTrainerProfileResponse
{
    /// <summary>
    /// Short biography of the trainer.
    /// </summary>
    public string? Bio { get; set; }

    /// <summary>
    /// Area of specialization (e.g. "Strength training", "Yoga").
    /// </summary>
    public string? Specialization { get; set; }

    /// <summary>
    /// Number of years of professional experience.
    /// </summary>
    public int YearsOfExperience { get; set; }
}
