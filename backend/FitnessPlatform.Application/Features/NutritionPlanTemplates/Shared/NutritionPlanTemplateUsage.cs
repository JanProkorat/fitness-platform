using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

/// <summary>
/// Counts how many of a nutritionist's Active plans were built from each template.
/// </summary>
public static class NutritionPlanTemplateUsage
{
    /// <summary>
    /// Counts the caller's own Active plans per source template, optionally for one template only.
    /// Other nutritionists' plans are never counted, so a shared Public template never leaks its
    /// owner's client count.
    /// </summary>
    /// <param name="mongo">MongoDB context.</param>
    /// <param name="callerId">Nutritionist whose plans are counted.</param>
    /// <param name="templateId">When set, restricts the count to this template.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<Dictionary<Guid, int>> LoadCallerUsageAsync(
        IMongoContext mongo, Guid callerId, Guid? templateId, CancellationToken ct)
    {
        var filterBuilder = Builders<NutritionPlan>.Filter;
        var planFilter = filterBuilder.Eq(p => p.NutritionistId, callerId)
                         & filterBuilder.Eq(p => p.Status, NutritionPlanStatus.Active)
                         & (templateId.HasValue
                             ? filterBuilder.Eq(p => p.SourceTemplateId, templateId.Value)
                             : filterBuilder.Ne(p => p.SourceTemplateId, null));

        var sourceTemplateIds = await mongo.NutritionPlans
            .Find(planFilter)
            .Project(p => p.SourceTemplateId)
            .ToListAsync(ct);

        return sourceTemplateIds
            .Where(id => id.HasValue)
            .GroupBy(id => id!.Value)
            .ToDictionary(group => group.Key, group => group.Count());
    }
}
