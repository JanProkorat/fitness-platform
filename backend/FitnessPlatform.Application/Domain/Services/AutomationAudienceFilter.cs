using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// The single predicate that decides which of a coach's automation rules apply to a client.
/// </summary>
public static class AutomationAudienceFilter
{
    /// <summary>
    /// Keeps the coach's rules that cover the client: global rules whose audience includes the client
    /// (All; Tag with a tag the client carries; Chosen listing the client) plus the client's own
    /// client-only rules. A Tag audience whose tag was deleted covers nobody.
    /// </summary>
    /// <param name="rules">The rules to filter.</param>
    /// <param name="ownerProfessionalProfileId">The coach's professional profile id.</param>
    /// <param name="clientProfileId">The client's profile id.</param>
    /// <param name="clientTagIds">Ids of the coach's tags assigned to the client across the coach's live links.</param>
    public static IQueryable<AutomationRule> CoveringClient(
        this IQueryable<AutomationRule> rules,
        long ownerProfessionalProfileId,
        long clientProfileId,
        IEnumerable<long> clientTagIds)
    {
        var tagIds = clientTagIds.ToList();

        return rules.Where(r =>
            r.OwnerProfessionalProfileId == ownerProfessionalProfileId &&
            ((r.ClientProfileId == null &&
              (r.Audience == AutomationAudience.All ||
               (r.Audience == AutomationAudience.Tag &&
                r.AudienceTagId != null &&
                tagIds.Contains(r.AudienceTagId.Value)) ||
               (r.Audience == AutomationAudience.Chosen &&
                r.AudienceClients.Any(c => c.ClientProfileId == clientProfileId)))) ||
             r.ClientProfileId == clientProfileId));
    }

    /// <summary>
    /// In-memory twin of <see cref="CoveringClient"/> for a rule already loaded with its audience
    /// clients: whether the rule applies to the client. Both must change together.
    /// </summary>
    /// <param name="rule">The rule, loaded with its audience clients.</param>
    /// <param name="clientProfileId">The client's profile id.</param>
    /// <param name="clientTagIds">Ids of the coach's tags assigned to the client.</param>
    public static bool Covers(AutomationRule rule, long clientProfileId, IReadOnlySet<long> clientTagIds)
    {
        if (rule.ClientProfileId is not null)
        {
            return rule.ClientProfileId == clientProfileId;
        }

        return rule.Audience switch
        {
            AutomationAudience.All => true,
            AutomationAudience.Tag => rule.AudienceTagId is not null && clientTagIds.Contains(rule.AudienceTagId.Value),
            AutomationAudience.Chosen => rule.AudienceClients.Any(c => c.ClientProfileId == clientProfileId),
            _ => false,
        };
    }
}
