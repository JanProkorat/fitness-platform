using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// Query helpers shared by the automation rule endpoints.
/// </summary>
public static class AutomationRuleQueries
{
    /// <summary>Includes everything <see cref="AutomationRuleDto.FromEntity"/> reads.</summary>
    public static IQueryable<AutomationRule> WithDetails(this IQueryable<AutomationRule> rules) => rules
        .Include(r => r.Questionnaire)
        .Include(r => r.AudienceTag)
        .Include(r => r.ClientProfile)
        .Include(r => r.AudienceClients).ThenInclude(a => a.ClientProfile).ThenInclude(c => c.User)
        .AsSplitQuery();
}
