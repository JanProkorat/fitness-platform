namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.Shared;

/// <summary>
/// Shared ownership predicate for the client-facing photo diary request endpoints
/// (Accept, Dismiss, Submit, GetClientPhotoDiaryRequest). A request is owned by the
/// calling client when its link points at that client's active profile, or when its
/// pending invite matches the caller's email claim.
/// </summary>
public static class PhotoDiaryRequestOwnership
{
    /// <summary>
    /// Determines whether the given photo diary request belongs to the calling client.
    /// </summary>
    public static bool IsOwnedByClient(
        Domain.Entities.PhotoDiaryRequest request,
        Guid clientUserId,
        string? clientEmail)
    {
        if (request.Link is not null)
            return request.Link.ClientProfile.UserId == clientUserId && request.Link.IsActive;

        if (request.PendingInvite is not null && clientEmail is not null)
            return string.Equals(request.PendingInvite.Email, clientEmail,
                StringComparison.OrdinalIgnoreCase);

        return false;
    }
}
