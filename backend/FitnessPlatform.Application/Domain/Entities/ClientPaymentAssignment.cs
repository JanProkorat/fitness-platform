using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// One coach's payment relationship with one client: the client's number in the coach's books, the terms
/// they pay under and their payments. Created on the first terms or one-off payment and never deleted.
/// </summary>
public class ClientPaymentAssignment : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the coach's <see cref="ProfessionalProfile"/>.
    /// </summary>
    public long ProfessionalProfileId { get; set; }

    /// <summary>
    /// Foreign key to the paying client's <see cref="ClientProfile"/>.
    /// </summary>
    public long ClientProfileId { get; set; }

    /// <summary>
    /// The client's number in this coach's books (1-9999), allocated on first assignment and never reused.
    /// It is the tail of the variable symbol.
    /// </summary>
    public int ClientNumber { get; set; }

    /// <summary>
    /// Navigation property to the coach.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;

    /// <summary>
    /// Navigation property to the client.
    /// </summary>
    public ClientProfile ClientProfile { get; set; } = null!;

    /// <summary>
    /// Terms history, one row per change.
    /// </summary>
    public ICollection<ClientPaymentTerms> Terms { get; set; } = [];

    /// <summary>
    /// The client's payments.
    /// </summary>
    public ICollection<ClientPayment> Payments { get; set; } = [];
}
