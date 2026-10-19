using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A coach-owned automation rule that sends a request to clients on a schedule or after an event.
/// A global rule (<see cref="ClientProfileId"/> null) applies to its audience; a client-only rule
/// applies to exactly one client and carries no audience.
/// </summary>
public class AutomationRule : PublicTimestampableEntity
{
    /// <summary>Foreign key to the owning <see cref="ProfessionalProfile"/>.</summary>
    public long OwnerProfessionalProfileId { get; set; }

    /// <summary>The single client a client-only rule belongs to; null for a global rule.</summary>
    public long? ClientProfileId { get; set; }

    /// <summary>Rule name shown to the coach.</summary>
    [MaxLength(100)]
    public required string Name { get; set; }

    /// <summary>Optional text sent with the request.</summary>
    [MaxLength(1000)]
    public string? Message { get; set; }

    /// <summary>What the rule asks of the client.</summary>
    public AutomationActionType ActionType { get; set; }

    /// <summary>The questionnaire sent by a <see cref="AutomationActionType.SendForm"/> rule.</summary>
    public long? QuestionnaireId { get; set; }

    /// <summary>Schedule or event trigger.</summary>
    public AutomationTriggerKind TriggerKind { get; set; }

    /// <summary>Schedule trigger: send every N units.</summary>
    public int? ScheduleInterval { get; set; }

    /// <summary>Schedule trigger: unit of the interval.</summary>
    public AutomationScheduleUnit? ScheduleUnit { get; set; }

    /// <summary>Schedule trigger: client-local time of day.</summary>
    public TimeOnly? LocalTime { get; set; }

    /// <summary>Event trigger: the event.</summary>
    public AutomationEventType? EventType { get; set; }

    /// <summary>Event trigger: days between the event and the send.</summary>
    public int? EventOffsetDays { get; set; }

    /// <summary>Event trigger: whether the offset lands before or after the event.</summary>
    public AutomationOffsetDirection? EventOffsetDirection { get; set; }

    /// <summary>Plan events only: fire at most once per plan.</summary>
    public bool OncePerPlan { get; set; }

    /// <summary>Skip an occurrence while the previous request is still unanswered.</summary>
    public bool SkipWhilePreviousUnanswered { get; set; } = true;

    /// <summary>Stop after this many sends per client; null means no limit.</summary>
    public int? StopAfterSends { get; set; }

    /// <summary>Whether the rule is active.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Which clients a global rule applies to.</summary>
    public AutomationAudience Audience { get; set; } = AutomationAudience.All;

    /// <summary>The tag of a <see cref="AutomationAudience.Tag"/> audience; set to null when the tag is deleted.</summary>
    public long? AudienceTagId { get; set; }

    /// <summary>Navigation to the owning professional profile.</summary>
    public ProfessionalProfile OwnerProfessionalProfile { get; set; } = null!;

    /// <summary>Navigation to the client of a client-only rule.</summary>
    public ClientProfile? ClientProfile { get; set; }

    /// <summary>Navigation to the questionnaire sent by the rule.</summary>
    public Questionnaire? Questionnaire { get; set; }

    /// <summary>Navigation to the audience tag.</summary>
    public ClientTag? AudienceTag { get; set; }

    /// <summary>Clients of a <see cref="AutomationAudience.Chosen"/> audience.</summary>
    public ICollection<AutomationRuleAudienceClient> AudienceClients { get; set; } = [];

    /// <summary>Per-client overrides of this rule.</summary>
    public ICollection<AutomationClientOverride> Overrides { get; set; } = [];
}
