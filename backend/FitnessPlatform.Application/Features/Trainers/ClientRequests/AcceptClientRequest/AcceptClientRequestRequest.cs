namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.AcceptClientRequest;

/// <summary>
/// Request model for accepting a client request.
/// </summary>
public class AcceptClientRequestRequest
{
    /// <summary>
    /// Public identifier of the client request (from route).
    /// </summary>
    public Guid PublicId { get; set; }

    /// <summary>
    /// Optional public ID of a questionnaire to assign to the client upon acceptance.
    /// </summary>
    public Guid? QuestionnairePublicId { get; set; }

    /// <summary>
    /// Optional statement from the professional (saved for future display in chat).
    /// </summary>
    public string? Statement { get; set; }
}
