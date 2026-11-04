using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// How much history a client holds: all their nutrition and training plans (from any coach), body
/// measurements and progress photos.
/// </summary>
/// <param name="PlanCount">Nutrition plus training plans.</param>
/// <param name="MeasurementCount">Body measurements.</param>
/// <param name="PhotoCount">Progress photos.</param>
public readonly record struct ClientHistoryCounts(int PlanCount, int MeasurementCount, int PhotoCount)
{
    /// <summary>
    /// Counts the history of many clients with one query per store, never one per client.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="mongo">MongoDB context.</param>
    /// <param name="clients">The clients: internal profile id and user id (the key the plan documents use).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Counts keyed by client profile id; every given client has an entry.</returns>
    public static async Task<Dictionary<long, ClientHistoryCounts>> LoadAsync(
        IApplicationDbContext db,
        IMongoContext mongo,
        IReadOnlyCollection<(long ProfileId, Guid UserId)> clients,
        CancellationToken ct)
    {
        if (clients.Count == 0)
        {
            return [];
        }

        var profileIds = clients.Select(client => client.ProfileId).Distinct().ToList();
        var userIds = clients.Select(client => client.UserId).Distinct().ToList();

        var measurementRows = await db.BodyMeasurements
            .AsNoTracking()
            .Where(measurement => profileIds.Contains(measurement.ClientProfileId))
            .GroupBy(measurement => measurement.ClientProfileId)
            .Select(group => new { ProfileId = group.Key, Count = group.Count() })
            .ToListAsync(ct);

        var photoRows = await db.PlanPhotos
            .AsNoTracking()
            .Where(photo => profileIds.Contains(photo.ClientProfileId))
            .GroupBy(photo => photo.ClientProfileId)
            .Select(group => new { ProfileId = group.Key, Count = group.Count() })
            .ToListAsync(ct);

        var nutritionOwners = await mongo.NutritionPlans
            .Find(Builders<NutritionPlan>.Filter.In(plan => plan.ClientId, userIds))
            .Project(plan => plan.ClientId)
            .ToListAsync(ct);

        var trainingOwners = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.In(plan => plan.ClientId, userIds))
            .Project(plan => plan.ClientId)
            .ToListAsync(ct);

        var measurements = measurementRows.ToDictionary(row => row.ProfileId, row => row.Count);
        var photos = photoRows.ToDictionary(row => row.ProfileId, row => row.Count);
        var plans = nutritionOwners.Concat(trainingOwners)
            .GroupBy(userId => userId)
            .ToDictionary(group => group.Key, group => group.Count());

        return clients
            .GroupBy(client => client.ProfileId)
            .ToDictionary(
                group => group.Key,
                group => new ClientHistoryCounts(
                    plans.GetValueOrDefault(group.First().UserId),
                    measurements.GetValueOrDefault(group.Key),
                    photos.GetValueOrDefault(group.Key)));
    }
}
