using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Loads the date windows of the plans a coach wrote for their clients, one typed query per plan
/// collection, keyed on the client's user id (the key plan documents carry).
/// </summary>
public static class AutomationPlanWindowLoader
{
    /// <summary>
    /// Loads the Active plans the coach authored. Training plans are read only for the clients in
    /// <paramref name="trainingClientUserIds"/> and nutrition plans only for
    /// <paramref name="nutritionClientUserIds"/>, so a link without the domain never exposes its plans.
    /// </summary>
    /// <param name="mongo">MongoDB context.</param>
    /// <param name="coachUserId">The coach's user id; plans by anyone else never count.</param>
    /// <param name="trainingClientUserIds">Clients whose live link grants the training domain.</param>
    /// <param name="nutritionClientUserIds">Clients whose live link grants the nutrition domain.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The plan windows grouped by client user id.</returns>
    public static async Task<Dictionary<Guid, List<AutomationPlanWindow>>> LoadAsync(
        IMongoContext mongo,
        Guid coachUserId,
        IReadOnlyCollection<Guid> trainingClientUserIds,
        IReadOnlyCollection<Guid> nutritionClientUserIds,
        CancellationToken ct)
    {
        var result = new Dictionary<Guid, List<AutomationPlanWindow>>();

        if (trainingClientUserIds.Count > 0)
        {
            var trainingFilter = Builders<TrainingPlan>.Filter.And(
                Builders<TrainingPlan>.Filter.In(p => p.ClientId, trainingClientUserIds),
                Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, coachUserId),
                Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active));

            var trainingWindows = await mongo.TrainingPlans
                .Find(trainingFilter)
                .Project(p => new AutomationPlanWindow
                {
                    ClientId = p.ClientId,
                    StartDate = p.StartDate,
                    WeekCount = p.Weeks.Count,
                })
                .ToListAsync(ct);

            Add(result, trainingWindows);
        }

        if (nutritionClientUserIds.Count > 0)
        {
            var nutritionFilter = Builders<NutritionPlan>.Filter.And(
                Builders<NutritionPlan>.Filter.In(p => p.ClientId, nutritionClientUserIds),
                Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, coachUserId),
                Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

            var nutritionWindows = await mongo.NutritionPlans
                .Find(nutritionFilter)
                .Project(p => new AutomationPlanWindow
                {
                    ClientId = p.ClientId,
                    StartDate = p.StartDate,
                    WeekCount = p.Weeks.Count,
                })
                .ToListAsync(ct);

            Add(result, nutritionWindows);
        }

        return result;
    }

    private static void Add(Dictionary<Guid, List<AutomationPlanWindow>> target, List<AutomationPlanWindow> windows)
    {
        foreach (var window in windows)
        {
            if (!target.TryGetValue(window.ClientId, out var list))
            {
                list = [];
                target[window.ClientId] = list;
            }

            list.Add(window);
        }
    }
}
