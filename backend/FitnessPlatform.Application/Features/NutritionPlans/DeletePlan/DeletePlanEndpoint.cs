using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.DeletePlan;

/// <summary>
/// Permanently deletes a nutrition plan that has not started yet.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational context, used to resolve the client's time zone.</param>
/// <param name="timeProvider">Clock.</param>
/// <param name="linkAuthorizationService">Resolves link capabilities — authorship identifies the
/// plan, the caller's live link to its client decides access.</param>
[RemovedCoachRole(AppRoles.Nutritionist, RemovedCoachRoleMode.WhilePlanInProgress)]
public class DeletePlanEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    TimeProvider timeProvider,
    IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<DeletePlanRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/nutrition/plans/{PlanId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Delete a nutrition plan";
            s.Description = "Permanently deletes a plan. Refused once any published week has started "
                            + "(the client's local date is on or after the week's first day).";
            s.Responses[StatusCodes.Status204NoContent] = "Plan deleted";
            s.Responses[StatusCodes.Status404NotFound] = "Plan not found, or not accessible to the caller";
            s.Responses[StatusCodes.Status409Conflict] =
                "PLAN_ALREADY_STARTED (a published week has started) or PLAN_VERSION_CONFLICT (modified concurrently)";
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
        var plan = await this.LoadOwnedNutritionPlanIfAllowedAsync(mongo, linkAuthorizationService, req.PlanId, nutritionistId, ct);

        if (plan is null)
        {
            return;
        }

        if (await HasStartedAsync(plan, ct))
        {
            await this.SendProblemAsync(409, ErrorCodes.PlanAlreadyStarted,
                "The plan has a published week that has already started and cannot be deleted.", ct);
            return;
        }

        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.Version, plan.Version);

        var result = await mongo.NutritionPlans.DeleteOneAsync(filter, ct);

        if (result.DeletedCount == 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                "Version conflict. The plan was modified by another request.", ct);
            return;
        }

        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// True when any published week's first day is on or before the client's local today.
    /// Week dates are derived from <see cref="NutritionPlan.StartDate"/>; a plan without one never started.
    /// </summary>
    private async Task<bool> HasStartedAsync(NutritionPlan plan, CancellationToken ct)
    {
        if (plan.StartDate is null)
        {
            return false;
        }

        var publishedWeekNumbers = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .Select(w => w.WeekNumber)
            .ToList();

        if (publishedWeekNumbers.Count == 0)
        {
            return false;
        }

        var clientTimeZone = await db.ResolveClientTimeZoneAsync(plan.ClientId, ct);
        var clientToday = ClientLocalDateResolver.ResolveLocalDate(timeProvider.GetUtcNow().UtcDateTime, clientTimeZone);
        var planStart = DateOnly.FromDateTime(plan.StartDate.Value);

        return publishedWeekNumbers.Any(weekNumber => planStart.AddDays((weekNumber - 1) * 7) <= clientToday);
    }
}
