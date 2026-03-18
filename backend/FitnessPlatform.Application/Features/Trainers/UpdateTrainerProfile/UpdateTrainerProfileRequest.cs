namespace FitnessPlatform.Application.Features.Trainers.UpdateTrainerProfile;

/// <summary>
/// Request model for updating the trainer's professional profile.
/// </summary>
public class UpdateTrainerProfileRequest
{
    /// <summary>
    /// Short biography of the trainer (max 1000 characters).
    /// </summary>
    public string? Bio { get; set; }

    /// <summary>
    /// Area of specialization (max 100 characters).
    /// </summary>
    public string? Specialization { get; set; }
}
