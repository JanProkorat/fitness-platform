namespace FitnessPlatform.Application.Domain.Enums;

public enum ClientRequestStatus
{
    Pending = 0,
    Accepted = 1,
    Rejected = 2,
    Cancelled = 3,

    /// <summary>The coach proposed a package and waits for the client to accept or decline it.</summary>
    PackageProposed = 4,

    /// <summary>The client declined the coach's package proposal; the request is over.</summary>
    ProposalDeclined = 5
}
