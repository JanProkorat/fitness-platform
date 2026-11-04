namespace FitnessPlatform.Application.Features.ClientRequests.AcceptClientRequestProposal;

/// <summary>
/// Request model for accepting a coach's package proposal.
/// </summary>
public class AcceptClientRequestProposalRequest
{
    /// <summary>
    /// Public identifier of the client request (from route).
    /// </summary>
    public Guid PublicId { get; set; }
}
