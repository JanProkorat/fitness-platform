using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Decides which clients a coach's automations may reach. A client is covered only while the coach
/// holds a live link to them that grants at least one domain; a link that grants nothing is never
/// counted and never receives a send.
/// </summary>
public static class AutomationCoverage
{
    /// <summary>
    /// Whether the capabilities of a live link make the client reachable by automations.
    /// </summary>
    public static bool IsCovered(LinkCapabilities capabilities) => !capabilities.GrantsNothing;

    /// <summary>
    /// Loads every client the coach's automations may reach, with the link facts the endpoints and
    /// the scheduler need.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="professionalProfileId">The coach's professional profile id.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<List<AutomationCoveredClient>> LoadCoveredClientsAsync(
        IApplicationDbContext db, long professionalProfileId, CancellationToken ct)
    {
        var links = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ProfessionalProfileId == professionalProfileId && l.IsActive)
            .Select(l => new LinkRow(
                l.Id,
                l.ClientProfileId,
                l.ClientProfile.UserId,
                l.ClientProfile.User.TimeZone,
                l.DateCreated,
                l.CanViewNutritionPlans,
                l.CanViewTrainingPlans))
            .ToListAsync(ct);

        var clientLinks = links
            .GroupBy(l => l.ClientProfileId)
            .Where(g => g.Any(l => IsCovered(new LinkCapabilities(l.CanViewNutritionPlans, l.CanViewTrainingPlans))))
            .ToList();

        if (clientLinks.Count == 0)
        {
            return [];
        }

        var linkIds = clientLinks.SelectMany(g => g.Select(l => l.LinkId)).ToList();

        var assignments = await db.ClientTagAssignments
            .AsNoTracking()
            .Where(a => linkIds.Contains(a.ClientProfessionalLinkId))
            .Select(a => new { a.ClientProfessionalLinkId, a.ClientTagId })
            .ToListAsync(ct);

        var tagsByLink = assignments
            .GroupBy(a => a.ClientProfessionalLinkId)
            .ToDictionary(g => g.Key, g => g.Select(a => a.ClientTagId).ToList());

        return clientLinks
            .Select(group => new AutomationCoveredClient
            {
                ClientProfileId = group.Key,
                ClientUserId = group.First().ClientUserId,
                TimeZoneId = group.First().TimeZoneId,
                LinkedSince = group.Min(l => l.DateCreated),
                CanViewNutritionPlans = group.Any(l => l.CanViewNutritionPlans),
                CanViewTrainingPlans = group.Any(l => l.CanViewTrainingPlans),
                TagIds = group
                    .SelectMany(l => tagsByLink.TryGetValue(l.LinkId, out var tags) ? tags : [])
                    .ToHashSet(),
            })
            .ToList();
    }

    private sealed record LinkRow(
        long LinkId,
        long ClientProfileId,
        Guid ClientUserId,
        string? TimeZoneId,
        DateTime DateCreated,
        bool CanViewNutritionPlans,
        bool CanViewTrainingPlans);
}
