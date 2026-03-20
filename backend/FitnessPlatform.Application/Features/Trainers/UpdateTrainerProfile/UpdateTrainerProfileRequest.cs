namespace FitnessPlatform.Application.Features.Trainers.UpdateTrainerProfile;

/// <summary>
/// Request model for updating the professional's profile.
/// </summary>
public class UpdateProfessionalProfileRequest
{
    /// <summary>
    /// Short biography of the professional (max 1000 characters).
    /// </summary>
    public string? Bio { get; set; }

    /// <summary>
    /// Area of specialization (max 100 characters).
    /// </summary>
    public string? Specialization { get; set; }
}
