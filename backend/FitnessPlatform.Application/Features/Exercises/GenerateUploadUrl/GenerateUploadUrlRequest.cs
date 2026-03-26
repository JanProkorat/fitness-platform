namespace FitnessPlatform.Application.Features.Exercises.GenerateUploadUrl;

/// <summary>
/// Request model for generating a video upload URL.
/// </summary>
public class GenerateUploadUrlRequest
{
    /// <summary>
    /// The public identifier of the exercise.
    /// </summary>
    public Guid ExerciseId { get; set; }

    /// <summary>
    /// Content type of the video file (e.g. "video/mp4").
    /// </summary>
    public string ContentType { get; set; } = "video/mp4";
}
