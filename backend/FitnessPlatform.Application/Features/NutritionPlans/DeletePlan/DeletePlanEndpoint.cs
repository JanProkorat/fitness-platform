using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.DeletePlan;

/// <summary>
/// Soft-deletes a nutrition plan by setting its status to Archived.
/// </summary>
/// <remarks>
/// Intentionally does not go through <see cref="Domain.Services.PlanConcurrencyGuard"/> —
/// this update scopes only by ExternalId + owner and never compares a caller-supplied
/// version, so there is no version-conflict branch for the guard to encapsulate. See the
/// guard's class doc-comment for the full Create/Delete exclusion rationale (#659 / #695).
/// </remarks>
/// <param name="mongo">MongoDB context.</param>
/// <param name="authHelper">Link capability helper — authorship identifies the plan, the caller's
/// live link to its client decides access.</param>
public class DeletePlanEndpoint(IMongoContext mongo, ProfessionalAuthHelper authHelper) : Endpoint<DeletePlanRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/nutrition/plans/{PlanId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Delete a nutrition plan";
            s.Description = "Soft-deletes a plan by archiving it. The data is preserved but no longer active.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeletePlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        // Verify authorship AND that the caller's link to the plan's client still grants
        // nutrition access.
        var plan = await this.LoadOwnedNutritionPlanIfAllowedAsync(mongo, authHelper, req.PlanId, nutritionistId, ct);

        if (plan is null)
        {
            return;
        }

        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);

        var update = Builders<NutritionPlan>.Update
            .Set(p => p.Status, NutritionPlanStatus.Archived)
            .Set(p => p.DateUpdated, DateTime.UtcNow)
            .Inc(p => p.Version, 1);

        await mongo.NutritionPlans.UpdateOneAsync(filter, update, cancellationToken: ct);

        await Send.NoContentAsync(ct);
    }
}
