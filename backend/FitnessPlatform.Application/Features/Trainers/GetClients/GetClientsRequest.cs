namespace FitnessPlatform.Application.Features.Trainers.GetClients;

/// <summary>
/// Request model for retrieving a trainer's client list with pagination.
/// </summary>
public class GetClientsRequest
{
    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;

    /// <summary>
    /// Optional search filter by client name or email.
    /// </summary>
    public string? Search { get; set; }
}
