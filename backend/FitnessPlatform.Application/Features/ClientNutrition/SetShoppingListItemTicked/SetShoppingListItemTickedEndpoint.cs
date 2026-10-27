using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.SetShoppingListItemTicked;

/// <summary>
/// Ticks or unticks a shopping-list item for the caller's current plan, week and food.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class SetShoppingListItemTickedEndpoint(IMongoContext mongo, IApplicationDbContext db, TimeProvider timeProvider)
    : Endpoint<SetShoppingListItemTickedRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/client/nutrition/plan/shopping-list/ticks");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Tick or untick a shopping-list item";
            s.Description = "Idempotently sets the tick state of one food in one week of the caller's current plan. " +
                            "The state is returned by GET /client/nutrition/plan/shopping-list.";
            s.Responses[StatusCodes.Status204NoContent] = "Tick state saved";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid week number or food id";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "No active plan, week not in the plan, or food not on that week's list";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetShoppingListItemTickedRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);
        var todayUtc = await db.ResolveClientLocalDateUtcAsync(clientId, timeProvider.GetUtcNow().UtcDateTime, ct);

        var planFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        using var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await planCursor.ToListAsync(ct);
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, todayUtc);

        var week = plan?.Weeks.FirstOrDefault(w => w.WeekNumber == req.WeekNumber);

        var foodOnWeekList = week is not null && week.Days
            .SelectMany(d => d.Meals)
            .SelectMany(m => m.Foods)
            .Any(f => f.FoodExternalId == req.FoodExternalId);

        if (plan is null || !foodOnWeekList)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var tickFilter = Builders<ShoppingListTick>.Filter.And(
            Builders<ShoppingListTick>.Filter.Eq(t => t.ClientId, clientId),
            Builders<ShoppingListTick>.Filter.Eq(t => t.PlanId, plan.ExternalId),
            Builders<ShoppingListTick>.Filter.Eq(t => t.WeekNumber, req.WeekNumber),
            Builders<ShoppingListTick>.Filter.Eq(t => t.FoodExternalId, req.FoodExternalId));

        if (req.IsTicked)
        {
            var upsert = Builders<ShoppingListTick>.Update
                .SetOnInsert(t => t.CreatedAt, timeProvider.GetUtcNow().UtcDateTime);

            await mongo.ShoppingListTicks.UpdateOneAsync(
                tickFilter, upsert, new UpdateOptions { IsUpsert = true }, ct);
        }
        else
        {
            await mongo.ShoppingListTicks.DeleteManyAsync(tickFilter, ct);
        }

        await Send.NoContentAsync(ct);
    }
}
