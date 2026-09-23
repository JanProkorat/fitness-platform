using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Messaging.Shared;

/// <summary>
/// Loads the professional caller's live client roster (live links only, archived links
/// excluded — the same population <c>GetClientsEndpoint</c> shows on its default tab) joined
/// with the per-client facts <see cref="ClientRosterFilterClassifier"/> needs, plus each
/// client's existing conversation for display. Shared by <c>GetConversationsEndpoint</c> and
/// <c>GetConversationFilterCountsEndpoint</c> — the two new actions in this slice — so a chip's
/// membership and its count are always computed from the identical roster.
/// </summary>
public static class ConversationRosterLoader
{
    /// <summary>
    /// A plan's window ending within this many days of "now" counts toward the EndingSoon chip —
    /// same threshold as <c>GetClientsEndpoint</c>.
    /// </summary>
    private const int EndingSoonWindowDays = 14;

    /// <summary>
    /// Loads every row of <paramref name="professionalUserId"/>'s live roster. Four independent
    /// SQL passes (links, conversations, new-check-ins, missing-check-ins — each keyed by client
    /// so no per-row round trip, mirroring the correlated-subquery cost shape
    /// <c>GetClientsEndpoint.LoadRosterAsync</c> uses) plus two Mongo plan-window projections.
    /// </summary>
    public static async Task<List<ConversationRosterRow>> LoadAsync(
        IApplicationDbContext db,
        IMongoContext mongo,
        long professionalProfileId,
        Guid professionalUserId,
        DateTime now,
        CancellationToken ct)
    {
        var links = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ProfessionalProfileId == professionalProfileId && l.IsActive)
            .Select(l => new LinkRow
            {
                ClientPublicId = l.ClientProfile.PublicId,
                ClientUserId = l.ClientProfile.User.Id,
                FirstName = l.ClientProfile.User.FirstName,
                LastName = l.ClientProfile.User.LastName,
                AvatarBlobUrl = l.ClientProfile.User.AvatarBlobUrl,
                CanViewNutritionPlans = l.CanViewNutritionPlans,
                CanViewTrainingPlans = l.CanViewTrainingPlans
            })
            .ToListAsync(ct);

        if (links.Count == 0)
        {
            return [];
        }

        var today = DateOnly.FromDateTime(now);
        var clientUserIds = links.Select(l => l.ClientUserId).ToList();

        var conversationByClient = await db.Conversations
            .AsNoTracking()
            .Where(c => c.ProfessionalUserId == professionalUserId && clientUserIds.Contains(c.ClientUserId))
            .Select(c => new ConversationRow
            {
                ClientUserId = c.ClientUserId,
                PublicId = c.PublicId,
                LastMessageText = c.LastMessageText,
                LastMessageAt = c.LastMessageAt,
                LastMessageSenderId = c.LastMessageSenderId,
                LastMessageHasImage = c.LastMessageHasImage,
                ArchivedByProfessionalAt = c.ArchivedByProfessionalAt,
                MessageCount = c.Messages.Count,
                UnreadMessageCount = c.Messages.Count(m => !m.IsRead && m.SenderUserId == c.ClientUserId)
            })
            .ToDictionaryAsync(c => c.ClientUserId, ct);

        var newCheckInProfessionsByClient = (await db.WeeklyCheckIns
            .AsNoTracking()
            .Where(w =>
                w.ProfessionalUserId == professionalUserId &&
                clientUserIds.Contains(w.ClientUserId) &&
                w.RespondedAt != null &&
                w.ReviewedByTrainerAt == null)
            .Select(w => new { w.ClientUserId, w.Profession })
            .ToListAsync(ct))
            .ToLookup(w => w.ClientUserId, w => w.Profession);

        var missingCheckInProfessionsByClient = (await db.WeeklyCheckIns
            .AsNoTracking()
            .Where(w =>
                w.ProfessionalUserId == professionalUserId &&
                clientUserIds.Contains(w.ClientUserId) &&
                (w.Status == WeeklyCheckInStatus.Expired || (w.DueAt != null && w.DueAt < now && w.RespondedAt == null)))
            .Select(w => new { w.ClientUserId, w.Profession })
            .ToListAsync(ct))
            .ToLookup(w => w.ClientUserId, w => w.Profession);

        var nutritionClientIds = links.Where(l => l.CanViewNutritionPlans).Select(l => l.ClientUserId).Distinct().ToList();
        var trainingClientIds = links.Where(l => l.CanViewTrainingPlans).Select(l => l.ClientUserId).Distinct().ToList();

        var nutritionByClient = await LoadCurrentNutritionPlansAsync(mongo, nutritionClientIds, today, ct);
        var trainingByClient = await LoadCurrentTrainingPlansAsync(mongo, trainingClientIds, today, ct);

        return links.Select(l =>
        {
            conversationByClient.TryGetValue(l.ClientUserId, out var conversation);

            var visibleProfessions = ProfessionScope(l.CanViewNutritionPlans, l.CanViewTrainingPlans);
            var hasNewCheckIn = newCheckInProfessionsByClient[l.ClientUserId].Any(visibleProfessions.Contains);
            var hasMissingCheckIn = missingCheckInProfessionsByClient[l.ClientUserId].Any(visibleProfessions.Contains);

            return new ConversationRosterRow
            {
                ClientUserId = l.ClientUserId,
                ClientPublicId = l.ClientPublicId,
                ClientFirstName = l.FirstName,
                ClientLastName = l.LastName,
                ClientAvatarBlobUrl = l.AvatarBlobUrl,
                ConversationPublicId = conversation?.PublicId,
                LastMessage = conversation?.LastMessageText ?? string.Empty,
                LastMessageAt = conversation?.LastMessageAt ?? DateTime.MinValue,
                LastMessageSenderId = conversation?.LastMessageSenderId,
                LastMessageHasImage = conversation?.LastMessageHasImage ?? false,
                IsArchivedByProfessional = conversation?.ArchivedByProfessionalAt is not null,
                ConversationMessageCount = conversation?.MessageCount ?? 0,
                UnreadMessageCount = conversation?.UnreadMessageCount ?? 0,
                HasNewCheckIn = hasNewCheckIn,
                HasMissingCheckIn = hasMissingCheckIn,
                IsEndingSoon =
                    (l.CanViewNutritionPlans && nutritionByClient.TryGetValue(l.ClientUserId, out var nutritionPlan) &&
                     IsEndingWithinWindow(nutritionPlan, today)) ||
                    (l.CanViewTrainingPlans && trainingByClient.TryGetValue(l.ClientUserId, out var trainingPlan) &&
                     IsEndingWithinWindow(trainingPlan, today))
            };
        }).ToList();
    }

    /// <summary>
    /// The professions a check-in must belong to for a link to count it — mirrors
    /// <c>GetClientsEndpoint</c>'s per-domain check-in gating: a link that does not grant a
    /// domain never counts that domain's check-in, even against the same client.
    /// </summary>
    private static HashSet<Profession> ProfessionScope(bool canViewNutritionPlans, bool canViewTrainingPlans)
    {
        var scope = new HashSet<Profession>();

        if (canViewNutritionPlans)
        {
            scope.Add(Profession.Nutrition);
        }

        if (canViewTrainingPlans)
        {
            scope.Add(Profession.Training);
        }

        return scope;
    }

    private static async Task<Dictionary<Guid, PlanWindowProjection>> LoadCurrentNutritionPlansAsync(
        IMongoContext mongo, List<Guid> clientUserIds, DateOnly today, CancellationToken ct)
    {
        if (clientUserIds.Count == 0)
        {
            return [];
        }

        var filter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.In(p => p.ClientId, clientUserIds),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var candidates = await mongo.NutritionPlans
            .Find(filter)
            .Project(p => new PlanWindowProjection { ClientId = p.ClientId, StartDate = p.StartDate, WeekCount = p.Weeks.Count })
            .ToListAsync(ct);

        return ResolveCurrentPlanByClient(candidates, today);
    }

    private static async Task<Dictionary<Guid, PlanWindowProjection>> LoadCurrentTrainingPlansAsync(
        IMongoContext mongo, List<Guid> clientUserIds, DateOnly today, CancellationToken ct)
    {
        if (clientUserIds.Count == 0)
        {
            return [];
        }

        var filter = Builders<TrainingPlan>.Filter.And(
            Builders<TrainingPlan>.Filter.In(p => p.ClientId, clientUserIds),
            Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active));

        var candidates = await mongo.TrainingPlans
            .Find(filter)
            .Project(p => new PlanWindowProjection { ClientId = p.ClientId, StartDate = p.StartDate, WeekCount = p.Weeks.Count })
            .ToListAsync(ct);

        return ResolveCurrentPlanByClient(candidates, today);
    }

    /// <summary>
    /// Groups Active-status plan candidates by client and keeps only the one (if any) whose
    /// window contains <paramref name="today"/>, via
    /// <see cref="PlanWindowResolver.ResolveCurrentPlanStrict{T}"/> — same strict (no legacy
    /// unranged fallback) resolution <c>GetClientsEndpoint</c> uses, so the two surfaces can
    /// never disagree about which plan is current.
    /// </summary>
    private static Dictionary<Guid, PlanWindowProjection> ResolveCurrentPlanByClient(
        List<PlanWindowProjection> candidates, DateOnly today)
    {
        var result = new Dictionary<Guid, PlanWindowProjection>();

        foreach (var group in candidates.GroupBy(p => p.ClientId))
        {
            var current = PlanWindowResolver.ResolveCurrentPlanStrict(
                group, p => p.StartDate, p => p.WeekCount, today);

            if (current is not null)
            {
                result[group.Key] = current;
            }
        }

        return result;
    }

    /// <summary>
    /// <paramref name="plan"/> is guaranteed to carry a non-null <c>StartDate</c> — only
    /// in-window plans resolved by <see cref="ResolveCurrentPlanByClient"/> ever reach here.
    /// </summary>
    private static bool IsEndingWithinWindow(PlanWindowProjection plan, DateOnly today)
    {
        var end = DateOnly.FromDateTime(plan.StartDate!.Value).AddDays(plan.WeekCount * 7);
        return end.DayNumber - today.DayNumber <= EndingSoonWindowDays;
    }

    /// <summary>One row of the caller's link roster, projected once from SQL.</summary>
    private sealed class LinkRow
    {
        public Guid ClientPublicId { get; init; }
        public Guid ClientUserId { get; init; }
        public string FirstName { get; init; } = string.Empty;
        public string LastName { get; init; } = string.Empty;
        public string? AvatarBlobUrl { get; init; }
        public bool CanViewNutritionPlans { get; init; }
        public bool CanViewTrainingPlans { get; init; }
    }

    /// <summary>The caller's existing conversation with one roster client, if any, keyed by that client.</summary>
    private sealed class ConversationRow
    {
        public Guid ClientUserId { get; init; }
        public Guid PublicId { get; init; }
        public string? LastMessageText { get; init; }
        public DateTime? LastMessageAt { get; init; }
        public Guid? LastMessageSenderId { get; init; }
        public bool LastMessageHasImage { get; init; }
        public DateTime? ArchivedByProfessionalAt { get; init; }
        public int MessageCount { get; init; }
        public int UnreadMessageCount { get; init; }
    }

    /// <summary>A projected Mongo plan candidate — just enough to resolve the current in-window plan.</summary>
    private sealed class PlanWindowProjection
    {
        public Guid ClientId { get; init; }
        public DateTime? StartDate { get; init; }
        public int WeekCount { get; init; }
    }
}
