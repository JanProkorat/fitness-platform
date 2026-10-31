namespace FitnessPlatform.Application.Features.Questionnaires.CreateResponse;

/// <summary>
/// Result of creating an in-progress questionnaire response.
/// </summary>
public class CreateResponseResponse
{
    /// <summary>Public id of the new response.</summary>
    public Guid ResponsePublicId { get; set; }
}
