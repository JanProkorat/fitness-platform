namespace FitnessPlatform.Application.Features.Trainers.GetTrainerProfile;

/// <summary>
/// Response model for the professional's own profile data.
/// </summary>
public class GetProfessionalProfileResponse
{
    /// <summary>
    /// Short biography of the professional.
    /// </summary>
    public string? Bio { get; set; }

    /// <summary>
    /// Legacy single specialization field.
    /// </summary>
    public string? Specialization { get; set; }

    /// <summary>
    /// City where the professional is based.
    /// </summary>
    public string? City { get; set; }

    /// <summary>
    /// Estimated price per month.
    /// </summary>
    public string? EstimatedPrice { get; set; }

    /// <summary>
    /// Specializations as a JSON array string.
    /// </summary>
    public string? Specializations { get; set; }

    /// <summary>
    /// Certificates and education as a JSON array string.
    /// </summary>
    public string? Certificates { get; set; }

    /// <summary>
    /// Spoken languages as a JSON array string.
    /// </summary>
    public string? Languages { get; set; }

    /// <summary>
    /// Collaboration type.
    /// </summary>
    public string? CollaborationType { get; set; }

    /// <summary>
    /// Maximum number of clients.
    /// </summary>
    public int? MaxClients { get; set; }

    /// <summary>
    /// LinkedIn profile URL or handle.
    /// </summary>
    public string? LinkedIn { get; set; }

    /// <summary>
    /// Instagram handle.
    /// </summary>
    public string? Instagram { get; set; }

    /// <summary>
    /// Website URL.
    /// </summary>
    public string? Website { get; set; }

    /// <summary>
    /// Whether the profile is visible in marketplace search.
    /// </summary>
    public bool ShowInSearch { get; set; }

    /// <summary>
    /// Whether the professional is currently accepting new clients.
    /// </summary>
    public bool AcceptNewClients { get; set; }
}
