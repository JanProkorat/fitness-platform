using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;

/// <summary>
/// Endpoint for logging a meal from the client's active plan as eaten.
/// Creates a <see cref="MealLog"/> document with a snapshot of the meal's foods.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class LogMealEatenEndpoint(IMongoContext mongo, IApplicationDbContext db) : Endpoint<LogMealEatenRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/nutrition/log/meals/{MealId}/eaten");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Log a meal as eaten";
            s.Description = "Records that the client has eaten a specific meal from their active nutrition plan.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(LogMealEatenRequest req, CancellationToken ct)
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

        var clientId = clientProfile.PublicId;

        var filter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var meal = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Meals)
            .FirstOrDefault(m => m.MealId == req.MealId);

        if (meal is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var mealLog = new MealLog
        {
            ClientId = clientId,
            PlanId = plan.ExternalId,
            MealId = req.MealId,
            EatenAt = DateTime.UtcNow,
            FoodsEaten = meal.Foods
        };

        await mongo.MealLogs.InsertOneAsync(mealLog, cancellationToken: ct);

        await HttpContext.Response.SendAsync(new { Message = "Meal logged successfully." }, 201, cancellation: ct);
    }
}
