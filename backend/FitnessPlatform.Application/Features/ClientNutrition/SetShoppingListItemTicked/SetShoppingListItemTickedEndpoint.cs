using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientNutrition.Shared;
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
            s.Responses[StatusCodes.Status404NotFound] = "No active plan, week not in the plan, or food is neither a meal food nor a recipe ingredient on that week's list";
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

        if (await ClientRequestDeduplicator.FindAsync(mongo, clientId, req.ClientRequestId, ct) is not null)
        {
            await Send.NoContentAsync(ct);
            return;
        }

        var todayUtc = await db.ResolveClientLocalDateUtcAsync(
            clientId, req.OccurredAt?.UtcDateTime ?? timeProvider.GetUtcNow().UtcDateTime, ct);

        var planFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        using var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await planCursor.ToListAsync(ct);
        // Falls back to the earliest upcoming plan with a published week, matching the shopping list read.
        var plan = PlanWindowResolver.ResolveCurrentOrUpcomingPlan(
            activePlans,
            p => p.StartDate,
            p => p.Weeks.Count,
            p => p.Weeks.Any(w => w.Status == WeekStatus.Published),
            p => p.DateCreated,
            todayUtc);

        var week = plan?.Weeks.FirstOrDefault(w => w.WeekNumber == req.WeekNumber);

        var foodOnWeekList = week is not null && (
            week.Days.SelectMany(d => d.Meals).SelectMany(m => m.Foods).Any(f => f.FoodExternalId == req.FoodExternalId)
            // Recipes are loaded only when the plain-food check misses.
            || (await ShoppingListRecipeIngredients.LoadAsync(mongo, [week], ct))
                .Any(entry => entry.Food.FoodExternalId == req.FoodExternalId));

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

            try
            {
                await mongo.ShoppingListTicks.UpdateOneAsync(
                    tickFilter, upsert, new UpdateOptions { IsUpsert = true }, ct);
            }
            catch (MongoCommandException ex) when (ex.Code == 11000)
            {
                // A concurrent first tick won the unique-index race; the item is ticked either way.
            }
            catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
            {
                // Same race, surfaced as a write error.
            }
        }
        else
        {
            await mongo.ShoppingListTicks.DeleteManyAsync(tickFilter, ct);
        }

        await ClientRequestDeduplicator.RecordAsync(
            mongo, clientId, req.ClientRequestId, "SetShoppingListItemTicked", req.BasedOnPlanVersion, null,
            timeProvider.GetUtcNow().UtcDateTime, ct);

        await Send.NoContentAsync(ct);
    }
}
