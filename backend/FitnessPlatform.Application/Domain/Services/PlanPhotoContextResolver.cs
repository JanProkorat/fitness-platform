using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Resolves which plan (nutrition or training) a plan-photo route's <c>{PlanId}</c> refers to
/// for a given client. Shared by <c>GeneratePlanPhotoUploadUrlEndpoint</c> and
/// <c>FinalizePlanPhotoEndpoint</c>, which both need the same own-plan lookup: nutrition first,
/// training only as a fallback, and both scoped by the caller's client id so a plan id that
/// belongs to a different client never resolves.
/// </summary>
public static class PlanPhotoContextResolver
{
    /// <summary>
    /// Looks up the plan by <paramref name="planId"/> and <paramref name="clientId"/>, trying
    /// <see cref="IMongoContext.NutritionPlans"/> first and falling back to
    /// <see cref="IMongoContext.TrainingPlans"/> only when no nutrition plan matches. A plan id
    /// present in both collections always resolves to nutrition.
    /// </summary>
    /// <param name="mongo">MongoDB context.</param>
    /// <param name="planId">The plan's external id, as addressed in the route.</param>
    /// <param name="clientId">The caller's client id (<c>ApplicationUser.Id</c>) — the plan must
    /// belong to this client, never just any client, to resolve.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// <c>(null, null, null)</c> when neither collection has a matching plan for this client.
    /// Otherwise the resolved <see cref="PlanPhotoType"/>, the plan's own <c>ExternalId</c> as
    /// <c>LinkId</c> (mirrors <c>PlanId</c> — see <c>PlanPhoto.LinkId</c>'s XML doc), and the
    /// owning professional's user id, or <c>null</c> when that field is an unset
    /// <see cref="Guid.Empty"/>.
    /// </returns>
    public static async Task<(PlanPhotoType? PlanType, Guid? LinkId, Guid? ProfessionalUserId)> ResolveAsync(
        IMongoContext mongo, Guid planId, Guid clientId, CancellationToken ct)
    {
        var nutritionFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, planId),
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId));

        var nutritionCursor = await mongo.NutritionPlans.FindAsync(nutritionFilter, cancellationToken: ct);
        var nutritionPlan = await nutritionCursor.FirstOrDefaultAsync(ct);

        if (nutritionPlan is not null)
        {
            return (PlanPhotoType.Nutrition, nutritionPlan.ExternalId,
                nutritionPlan.NutritionistId != Guid.Empty ? nutritionPlan.NutritionistId : null);
        }

        var trainingFilter = Builders<TrainingPlan>.Filter.And(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId),
            Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId));

        var trainingCursor = await mongo.TrainingPlans.FindAsync(trainingFilter, cancellationToken: ct);
        var trainingPlan = await trainingCursor.FirstOrDefaultAsync(ct);

        if (trainingPlan is not null)
        {
            return (PlanPhotoType.Training, trainingPlan.ExternalId,
                trainingPlan.TrainerId != Guid.Empty ? trainingPlan.TrainerId : null);
        }

        return (null, null, null);
    }
}
