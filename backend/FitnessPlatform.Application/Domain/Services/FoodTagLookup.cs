using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Shared read path for coach-private tags, used by every Foods and Recipes action that shows or
/// filters on tags. Every read is scoped by <c>OwnerUserId == callerUserId</c>.
/// </summary>
public static class FoodTagLookup
{
    /// <summary>
    /// Loads the tags the caller owns among <paramref name="tagIds"/>. The result is shorter than
    /// the (distinct) input when any id is unknown or owned by another coach, which is how the
    /// Replace endpoints detect a foreign tag.
    /// </summary>
    public static async Task<List<FoodTag>> FindOwnedTagsAsync(
        IMongoContext mongo, Guid callerUserId, IReadOnlyCollection<Guid> tagIds, CancellationToken ct)
    {
        if (tagIds.Count == 0)
        {
            return [];
        }

        return await mongo.FoodTags
            .Find(t => t.OwnerUserId == callerUserId && tagIds.Contains(t.ExternalId))
            .ToListAsync(ct);
    }

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
    /// Resolves the recipe ids the caller has assigned ANY of the supplied tags to. An empty list
    /// means "zero results", not "skip the filter".
    /// </summary>
    public static async Task<List<Guid>> FindRecipeIdsWithAnyTagAsync(
        IMongoContext mongo, Guid callerUserId, IReadOnlyCollection<Guid> tagIds, CancellationToken ct)
    {
        var filter = Builders<RecipeTagAssignment>.Filter.Eq(a => a.OwnerUserId, callerUserId)
            & Builders<RecipeTagAssignment>.Filter.AnyIn(a => a.TagIds, tagIds);

        var assignments = await mongo.RecipeTagAssignments.Find(filter).ToListAsync(ct);

        return assignments.Select(a => a.RecipeExternalId).Distinct().ToList();
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

        return await ResolveTagsAsync(
            mongo, callerUserId, assignments.Select(a => (a.FoodExternalId, a.TagIds)).ToList(), ct);
    }

    /// <summary>
    /// Resolves the tag chips for a page of recipes, same two-query shape as
    /// <see cref="GetTagsByFoodIdAsync"/>. A recipeId with no assignment is absent from the result.
    /// </summary>
    public static async Task<Dictionary<Guid, List<FoodTagDto>>> GetTagsByRecipeIdAsync(
        IMongoContext mongo, Guid callerUserId, IReadOnlyCollection<Guid> recipeIds, CancellationToken ct)
    {
        if (recipeIds.Count == 0)
        {
            return [];
        }

        var assignmentFilter = Builders<RecipeTagAssignment>.Filter.Eq(a => a.OwnerUserId, callerUserId)
            & Builders<RecipeTagAssignment>.Filter.In(a => a.RecipeExternalId, recipeIds);

        var assignments = await mongo.RecipeTagAssignments.Find(assignmentFilter).ToListAsync(ct);

        return await ResolveTagsAsync(
            mongo, callerUserId, assignments.Select(a => (a.RecipeExternalId, a.TagIds)).ToList(), ct);
    }

    private static async Task<Dictionary<Guid, List<FoodTagDto>>> ResolveTagsAsync(
        IMongoContext mongo,
        Guid callerUserId,
        List<(Guid TargetId, List<Guid> TagIds)> assignments,
        CancellationToken ct)
    {
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
            a => a.TargetId,
            a => a.TagIds
                .Where(tagsByExternalId.ContainsKey)
                .Select(id => FoodTagDto.FromDocument(tagsByExternalId[id]))
                .OrderBy(dto => dto.Name, StringComparer.OrdinalIgnoreCase)
                .ToList());
    }
}
