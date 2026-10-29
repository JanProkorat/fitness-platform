using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetFullPlan;

/// <summary>
/// Endpoint that returns all published weeks of the client's active nutrition plan,
/// with pre-computed date ranges and current position within the plan.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="timeProvider">Clock abstraction (#955) — lets tests pin the "now" instant deterministically.</param>
public class GetFullPlanEndpoint(IMongoContext mongo, IApplicationDbContext db, TimeProvider timeProvider) : EndpointWithoutRequest<GetFullPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/plan/full");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get full nutrition plan";
            s.Description = "Returns all published weeks of the client's active nutrition plan for mobile browsing.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;

        // Resolve the client's local calendar day (#935) — anchors plan-window resolution and
        // the current-week/day-of-week calculation below on the client's local "today".
        var todayLocalUtc = await db.ResolveClientLocalDateUtcAsync(clientId, timeProvider.GetUtcNow().UtcDateTime, ct);

        // Find the Active plan whose date window contains today — a client may hold several
        // sequential, non-overlapping Active plans (#780).
        var filter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var activePlans = await cursor.ToListAsync(ct);
        // Falls back to the earliest upcoming plan with a published week, so the client can browse it
        // before it starts; CurrentWeek stays null for it.
        var plan = PlanWindowResolver.ResolveCurrentOrUpcomingPlan(
            activePlans,
            p => p.StartDate,
            p => p.Weeks.Count,
            p => p.Weeks.Any(w => w.Status == WeekStatus.Published),
            p => p.DateCreated,
            todayLocalUtc);

        if (plan is null || !plan.Weeks.Any(w => w.Status == WeekStatus.Published))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Fetch all meal logs for this plan to determine which meals have been eaten
        var eatenMealIds = await mongo.MealLogs
            .Find(Builders<MealLog>.Filter.And(
                Builders<MealLog>.Filter.Eq(m => m.ClientId, clientId),
                Builders<MealLog>.Filter.Eq(m => m.PlanId, plan.ExternalId),
                Builders<MealLog>.Filter.Ne(m => m.EatenAt, null)))
            .Project(m => m.MealId)
            .ToListAsync(ct);

        await Send.OkAsync(GetFullPlanResponse.FromPlan(plan, todayLocalUtc, eatenMealIds), ct);
    }
}
