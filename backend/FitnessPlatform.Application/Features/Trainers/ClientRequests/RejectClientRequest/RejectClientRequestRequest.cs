namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.RejectClientRequest;

public class RejectClientRequestRequest
{
    /// <summary>
    /// Public identifier of the client request (from route).
    /// </summary>
    public Guid PublicId { get; set; }

    /// <summary>
    /// Optional statement from the professional (saved for future display in chat).
    /// </summary>
    public string? Statement { get; set; }
}
