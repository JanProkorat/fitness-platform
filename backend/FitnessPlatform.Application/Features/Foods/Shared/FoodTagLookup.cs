using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Foods.Shared;

/// <summary>
/// Shared read path for coach-private food tags, used by every Foods action that shows or filters
/// on tags — <see cref="SearchFoods.SearchFoodsEndpoint"/>, <see cref="GetFood.GetFoodEndpoint"/>,
/// <see cref="UpdateFood.UpdateFoodEndpoint"/>, and
/// <see cref="GetCustomFoods.GetCustomFoodsEndpoint"/> — so the two-step id-lookup-then-join never
/// drifts between call sites.
/// </summary>
/// <remarks>
/// Every read is scoped by <c>OwnerUserId == callerUserId</c>. Only nutritionists ever create a
/// <see cref="FoodTag"/> or a <see cref="FoodTagAssignment"/> (both write endpoints are
/// <c>Roles(AppRoles.Nutritionist)</c>), so a trainer-only or client caller's own user id can
/// never own one — the owner scoping alone is what makes tags invisible to them, with no separate
/// role check needed here.
/// </remarks>
public static class FoodTagLookup
{
    /// <summary>
    /// Resolves the food ids the caller has assigned ANY of the supplied tags to — the "match
    /// any" semantics the tags filter pill needs. Returns an empty list when the caller owns no
    /// matching assignment; the caller should treat that as "zero results", not as "skip the
    /// filter".
    /// </summary>
    public static async Task<List<Guid>> FindFoodIdsWithAnyTagAsync(
        IMongoContext mongo, Guid callerUserId, IReadOnlyCollection<Guid> tagIds, CancellationToken ct)
    {
        var filter = Builders<FoodTagAssignment>.Filter.Eq(a => a.OwnerUserId, callerUserId)
            & Builders<FoodTagAssignment>.Filter.AnyIn(a => a.TagIds, tagIds);

        var assignments = await mongo.FoodTagAssignments.Find(filter).ToListAsync(ct);

        return assignments.Select(a => a.FoodExternalId).Distinct().ToList();
    }

    /// <summary>
    /// Resolves the tag chips for a page of foods in two queries: the caller's own assignments
    /// for those foods, then the owned tags those assignments reference. A foodId with no
    /// assignment is simply absent from the result — callers should default to an empty list.
    /// </summary>
    public static async Task<Dictionary<Guid, List<FoodTagDto>>> GetTagsByFoodIdAsync(
        IMongoContext mongo, Guid callerUserId, IReadOnlyCollection<Guid> foodIds, CancellationToken ct)
    {
        if (foodIds.Count == 0)
        {
            return [];
        }

        var assignmentFilter = Builders<FoodTagAssignment>.Filter.Eq(a => a.OwnerUserId, callerUserId)
            & Builders<FoodTagAssignment>.Filter.In(a => a.FoodExternalId, foodIds);

        var assignments = await mongo.FoodTagAssignments.Find(assignmentFilter).ToListAsync(ct);

        if (assignments.Count == 0)
        {
            return [];
        }

        var referencedTagIds = assignments.SelectMany(a => a.TagIds).Distinct().ToList();

        var tagFilter = Builders<FoodTag>.Filter.Eq(t => t.OwnerUserId, callerUserId)
            & Builders<FoodTag>.Filter.In(t => t.ExternalId, referencedTagIds);

        var tags = await mongo.FoodTags.Find(tagFilter).ToListAsync(ct);
        var tagsByExternalId = tags.ToDictionary(t => t.ExternalId);

        return assignments.ToDictionary(
            a => a.FoodExternalId,
            a => a.TagIds
                .Where(tagsByExternalId.ContainsKey)
                .Select(id => FoodTagDto.FromDocument(tagsByExternalId[id]))
                .OrderBy(dto => dto.Name, StringComparer.OrdinalIgnoreCase)
                .ToList());
    }
}
