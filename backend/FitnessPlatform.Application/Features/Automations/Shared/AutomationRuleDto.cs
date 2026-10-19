using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// A coach's automation rule as returned by the management endpoints.
/// </summary>
public class AutomationRuleDto
{
    /// <summary>Public id of the rule.</summary>
    public Guid RuleId { get; set; }

    /// <summary>Rule name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional text sent with the request.</summary>
    public string? Message { get; set; }

    /// <summary>What the rule asks of the client.</summary>
    public AutomationActionType ActionType { get; set; }

    /// <summary>Public id of the questionnaire a SendForm rule sends.</summary>
    public Guid? QuestionnaireId { get; set; }

    /// <summary>Schedule or event trigger.</summary>
    public AutomationTriggerKind TriggerKind { get; set; }

    /// <summary>Schedule trigger: send every N units.</summary>
    public int? ScheduleInterval { get; set; }

    /// <summary>Schedule trigger: unit of the interval.</summary>
    public AutomationScheduleUnit? ScheduleUnit { get; set; }

    /// <summary>Schedule trigger: client-local time of day.</summary>
    public TimeSpan? LocalTime { get; set; }

    /// <summary>Event trigger: the event.</summary>
    public AutomationEventType? EventType { get; set; }

    /// <summary>Event trigger: days between the event and the send.</summary>
    public int? EventOffsetDays { get; set; }

    /// <summary>Event trigger: whether the offset lands before or after the event.</summary>
    public AutomationOffsetDirection? EventOffsetDirection { get; set; }

    /// <summary>Plan events only: fire at most once per plan.</summary>
    public bool OncePerPlan { get; set; }

    /// <summary>Skip an occurrence while the previous request is still unanswered.</summary>
    public bool SkipWhilePreviousUnanswered { get; set; }

    /// <summary>Stop after this many sends per client; null means no limit.</summary>
    public int? StopAfterSends { get; set; }

    /// <summary>Whether the rule is active.</summary>
    public bool Enabled { get; set; }

    /// <summary>Which clients the rule applies to; All for a client-only rule.</summary>
    public AutomationAudience Audience { get; set; }

    /// <summary>The audience tag; null when the audience is not Tag, or the tag was deleted.</summary>
    public AutomationRuleTagDto? Tag { get; set; }

    /// <summary>Chosen clients of a Chosen audience.</summary>
    public List<AutomationRuleClientDto> Clients { get; set; } = [];

    /// <summary>Public id of the client a client-only rule belongs to; null for a global rule.</summary>
    public Guid? OnlyClientId { get; set; }

    /// <summary>Maps a rule loaded with its detail navigations.</summary>
    public static AutomationRuleDto FromEntity(AutomationRule rule) => new()
    {
        RuleId = rule.PublicId,
        Name = rule.Name,
        Message = rule.Message,
        ActionType = rule.ActionType,
        QuestionnaireId = rule.Questionnaire?.PublicId,
        TriggerKind = rule.TriggerKind,
        ScheduleInterval = rule.ScheduleInterval,
        ScheduleUnit = rule.ScheduleUnit,
        LocalTime = rule.LocalTime?.ToTimeSpan(),
        EventType = rule.EventType,
        EventOffsetDays = rule.EventOffsetDays,
        EventOffsetDirection = rule.EventOffsetDirection,
        OncePerPlan = rule.OncePerPlan,
        SkipWhilePreviousUnanswered = rule.SkipWhilePreviousUnanswered,
        StopAfterSends = rule.StopAfterSends,
        Enabled = rule.Enabled,
        Audience = rule.Audience,
        Tag = rule.AudienceTag is null
            ? null
            : new AutomationRuleTagDto { TagId = rule.AudienceTag.PublicId, Name = rule.AudienceTag.Name },
        Clients = rule.AudienceClients
            .Select(a => new AutomationRuleClientDto
            {
                ClientId = a.ClientProfile.PublicId,
                FirstName = a.ClientProfile.User.FirstName,
                LastName = a.ClientProfile.User.LastName,
            })
            .OrderBy(c => c.LastName)
            .ThenBy(c => c.FirstName)
            .ToList(),
        OnlyClientId = rule.ClientProfile?.PublicId,
    };
}
