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
    public long? QuestionnaireId { get; set; }

    public ClientProfile ClientProfile { get; set; } = null!;
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;
    public Questionnaire? Questionnaire { get; set; }
}
