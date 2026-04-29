namespace FitnessPlatform.Application.Features.Trainers.GetClients;

/// <summary>
/// Response model for the trainer's client list.
/// </summary>
public class GetClientsResponse
{
    /// <summary>
    /// List of client summaries.
    /// </summary>
    public List<ClientSummary> Clients { get; set; } = [];

    /// <summary>
    /// Total number of clients matching the filter.
    /// </summary>
    public int TotalCount { get; set; }

    /// <summary>
    /// Current page number.
    /// </summary>
    public int Page { get; set; }

    /// <summary>
    /// Number of items per page.
    /// </summary>
    public int PageSize { get; set; }
}

/// <summary>
/// Summary of a client in the trainer's client list.
/// </summary>
public class ClientSummary
{
    /// <summary>
    /// Internal integer primary key of the ClientProfessionalLink row.
    /// Used to populate <c>linkId</c> on the photo-diary-request create form.
    /// </summary>
    public long LinkId { get; set; }

    /// <summary>
    /// Client profile's public ID.
    /// </summary>
    public Guid PublicId { get; set; }

    /// <summary>
    /// Client's email address.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Client's first name.
    /// </summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// Client's last name.
    /// </summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// Whether this trainer-client relationship is active.
    /// </summary>
    public bool IsActive { get; set; }

    /// <summary>
    /// Date when the trainer-client relationship was established.
    /// </summary>
    public DateTime LinkedAt { get; set; }
}
