using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

public class ClientRequest : PublicTimestampableEntity
{
    public long ClientProfileId { get; set; }
    public long ProfessionalProfileId { get; set; }

    [MaxLength(500)]
    public string? Message { get; set; }

    public ClientRequestStatus Status { get; set; } = ClientRequestStatus.Pending;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }

    /// <summary>
    /// Optional statement from the professional when accepting or declining (saved for future display in chat).
    /// </summary>
    [MaxLength(1000)]
    public string? Statement { get; set; }

    public long? QuestionnaireId { get; set; }

    /// <summary>
    /// Whether the client agreed to share their history with the professional. Stored only; not enforced yet.
    /// </summary>
    public bool ShareHistory { get; set; }

    /// <summary>
    /// Optional package of the coach the client attached to the request.
    /// </summary>
    public long? CoachPackageId { get; set; }

    /// <summary>
    /// Discount the coach chose on accept; never set without a package.
    /// </summary>
    public long? CoachDiscountId { get; set; }

    /// <summary>
    /// Package the coach proposed while <see cref="Status"/> is <see cref="ClientRequestStatus.PackageProposed"/>;
    /// kept after the client answers, cleared when the coach withdraws.
    /// </summary>
    public long? ProposedPackageId { get; set; }

    /// <summary>
    /// Discount the coach proposed with the package; never set without a proposed package.
    /// </summary>
    public long? ProposedDiscountId { get; set; }

    /// <summary>
    /// When the coach proposed the package (UTC).
    /// </summary>
    public DateTime? ProposedAt { get; set; }

    public CoachPackage? CoachPackage { get; set; }
    public CoachDiscount? CoachDiscount { get; set; }
    public CoachPackage? ProposedPackage { get; set; }
    public CoachDiscount? ProposedDiscount { get; set; }

    public ClientProfile ClientProfile { get; set; } = null!;
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;
    public Questionnaire? Questionnaire { get; set; }
}
