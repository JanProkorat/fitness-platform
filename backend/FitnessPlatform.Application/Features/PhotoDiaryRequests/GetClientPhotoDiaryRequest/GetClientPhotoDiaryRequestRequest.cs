namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.GetClientPhotoDiaryRequest;

/// <summary>
/// Route-bound request for GET /client/photo-diary-requests/{Id}.
/// </summary>
public class GetClientPhotoDiaryRequestRequest
{
    public Guid Id { get; set; }
}
