using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Archives the Draft and Active plans one professional authored for one client when their link ends.
/// </summary>
public static class CollaborationPlanArchiver
{
    /// <summary>
    /// Archives the professional's own Draft/Active plans for the client in the selected disciplines.
    /// Other professionals' plans for the same client are never touched.
    /// </summary>
    /// <remarks>
    /// Run it BEFORE deactivating the link: a failed write then leaves the link active and the whole
    /// operation retryable, instead of Active plans nobody can reach. The <c>Version</c> bump is
    /// load-bearing: it turns a racing version-gated plan update into a 409 instead of resurrecting
    /// the plan as Active. Archiving is not reversible; re-linking does not un-archive.
    /// </remarks>
    /// <param name="mongo">MongoDB context.</param>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id.</param>
    /// <param name="clientUserId">The client's ApplicationUser.Id (the key plan documents carry).</param>
    /// <param name="archiveNutrition">Archive the nutrition plans.</param>
    /// <param name="archiveTraining">Archive the training plans.</param>
    /// <param name="now">Timestamp written to DateUpdated.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task ArchiveAsync(
        IMongoContext mongo,
        Guid professionalUserId,
        Guid clientUserId,
        bool archiveNutrition,
        bool archiveTraining,
        DateTime now,
        CancellationToken ct)
    {
        if (archiveNutrition)
        {
            var nutritionFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientUserId)
                                  & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, professionalUserId)
                                  & Builders<NutritionPlan>.Filter.In(
                                      p => p.Status,
                                      new[] { NutritionPlanStatus.Draft, NutritionPlanStatus.Active });

            var nutritionUpdate = Builders<NutritionPlan>.Update
                .Set(p => p.Status, NutritionPlanStatus.Archived)
                .Set(p => p.DateUpdated, now)
                .Inc(p => p.Version, 1);

            await mongo.NutritionPlans.UpdateManyAsync(nutritionFilter, nutritionUpdate, cancellationToken: ct);
        }

        if (archiveTraining)
        {
            var trainingFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientUserId)
                                 & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, professionalUserId)
                                 & Builders<TrainingPlan>.Filter.In(
                                     p => p.Status,
                                     new[] { TrainingPlanStatus.Draft, TrainingPlanStatus.Active });

            var trainingUpdate = Builders<TrainingPlan>.Update
                .Set(p => p.Status, TrainingPlanStatus.Archived)
                .Set(p => p.DateUpdated, now)
                .Inc(p => p.Version, 1);

            await mongo.TrainingPlans.UpdateManyAsync(trainingFilter, trainingUpdate, cancellationToken: ct);
        }
    }
}
