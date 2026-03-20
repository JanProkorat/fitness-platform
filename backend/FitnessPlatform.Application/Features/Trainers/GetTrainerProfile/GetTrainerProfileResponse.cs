namespace FitnessPlatform.Application.Features.Trainers.GetTrainerProfile;

/// <summary>
/// Response model for the professional's own profile data.
/// </summary>
public class GetProfessionalProfileResponse
{
    /// <summary>
    /// Short biography of the professional.
    /// </summary>
    public string? Bio { get; set; }

    /// <summary>
    /// Area of specialization (e.g. "Strength training", "Yoga").
    /// </summary>
    public string? Specialization { get; set; }
}
