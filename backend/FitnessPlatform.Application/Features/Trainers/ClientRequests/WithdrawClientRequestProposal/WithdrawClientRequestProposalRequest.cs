namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.WithdrawClientRequestProposal;

/// <summary>
/// Request model for withdrawing a package proposal.
/// </summary>
public class WithdrawClientRequestProposalRequest
{
    /// <summary>
    /// Public identifier of the client request (from route).
    /// </summary>
    public Guid PublicId { get; set; }
}
