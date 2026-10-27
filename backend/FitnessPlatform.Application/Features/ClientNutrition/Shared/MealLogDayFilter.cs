using FitnessPlatform.Application.Domain.Documents;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.Shared;

/// <summary>
/// Builds the filter that finds a client's meal-log rows for one client-local calendar day,
/// matching both the modern <c>LogDate == day</c> shape and legacy rows keyed only by an
/// <c>EatenAt</c> inside the day's instant window.
/// </summary>
internal static class MealLogDayFilter
{
    /// <summary>
    /// Builds the filter for one plan and day. When <paramref name="mealId"/> is null every meal matches.
    /// </summary>
    public static FilterDefinition<MealLog> Build(
        Guid clientId, Guid planId, Guid? mealId, DateTime dayUtc, DateTime windowStartUtc, DateTime windowEndUtc)
    {
        var filters = new List<FilterDefinition<MealLog>>
        {
            Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<MealLog>.Filter.Eq(l => l.PlanId, planId),
            Builders<MealLog>.Filter.Or(
                Builders<MealLog>.Filter.Eq(l => l.LogDate, dayUtc),
                Builders<MealLog>.Filter.And(
                    Builders<MealLog>.Filter.Gte(l => l.EatenAt, windowStartUtc),
                    Builders<MealLog>.Filter.Lt(l => l.EatenAt, windowEndUtc))),
        };

        if (mealId.HasValue)
        {
            filters.Add(Builders<MealLog>.Filter.Eq(l => l.MealId, mealId.Value));
        }

        return Builders<MealLog>.Filter.And(filters);
    }

    /// <summary>
    /// Builds the filter for every row of one plan in the inclusive day range, in one query.
    /// </summary>
    public static FilterDefinition<MealLog> BuildRange(
        Guid clientId, Guid planId, DateTime firstDayUtc, DateTime lastDayUtc, DateTime rangeStartUtc, DateTime rangeEndUtc) =>
        Builders<MealLog>.Filter.And(
            Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<MealLog>.Filter.Eq(l => l.PlanId, planId),
            Builders<MealLog>.Filter.Or(
                Builders<MealLog>.Filter.And(
                    Builders<MealLog>.Filter.Gte(l => l.LogDate, firstDayUtc),
                    Builders<MealLog>.Filter.Lte(l => l.LogDate, lastDayUtc)),
                Builders<MealLog>.Filter.And(
                    Builders<MealLog>.Filter.Gte(l => l.EatenAt, rangeStartUtc),
                    Builders<MealLog>.Filter.Lt(l => l.EatenAt, rangeEndUtc))));

    /// <summary>
    /// In-memory counterpart of <see cref="Build"/> for one row and one day.
    /// </summary>
    public static bool Matches(MealLog log, DateTime dayUtc, DateTime windowStartUtc, DateTime windowEndUtc) =>
        log.LogDate == dayUtc
        || (log.EatenAt.HasValue && log.EatenAt.Value >= windowStartUtc && log.EatenAt.Value < windowEndUtc);
}
