using FitnessPlatform.Application.Domain.Documents;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.Shared;

/// <summary>
/// Builds the filter that finds a client's day log for the client-local "today", matching both
/// the modern <c>LogDate == today</c> shape and logs created inside today's instant window.
/// </summary>
internal static class TodayDayLogFilter
{
    /// <summary>
    /// Builds the filter. When <paramref name="planId"/> is null the log of any plan matches.
    /// </summary>
    public static FilterDefinition<DayLog> Build(
        Guid clientId, Guid? planId, DateTime todayUtc, DateTime windowStartUtc, DateTime windowEndUtc)
    {
        var filters = new List<FilterDefinition<DayLog>>
        {
            Builders<DayLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<DayLog>.Filter.Or(
                Builders<DayLog>.Filter.Eq(l => l.LogDate, todayUtc),
                Builders<DayLog>.Filter.And(
                    Builders<DayLog>.Filter.Gte(l => l.CreatedAt, windowStartUtc),
                    Builders<DayLog>.Filter.Lt(l => l.CreatedAt, windowEndUtc))),
        };

        if (planId.HasValue)
        {
            filters.Add(Builders<DayLog>.Filter.Eq(l => l.PlanId, planId.Value));
        }

        return Builders<DayLog>.Filter.And(filters);
    }
}
