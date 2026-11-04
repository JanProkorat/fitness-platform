namespace FitnessPlatform.Application.Features.ClientRequests.DeclineClientRequestProposal;

/// <summary>
/// Request model for declining a coach's package proposal.
/// </summary>
public class DeclineClientRequestProposalRequest
{
    /// <summary>
    /// Public identifier of the client request (from route).
    /// </summary>
    public Guid PublicId { get; set; }
}
