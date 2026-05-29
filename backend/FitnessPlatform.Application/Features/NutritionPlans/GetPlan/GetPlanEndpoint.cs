using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.GetPlan;

/// <summary>
/// Retrieves a single nutrition plan with full detail (weeks, days, meals, foods).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetPlanEndpoint(IMongoContext mongo) : Endpoint<GetPlanRequest, GetPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/nutrition/plans/{PlanId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get a nutrition plan";
            s.Description = "Returns the full nutrition plan with all weeks, days, meals, and foods.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId);
        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.NutritionistId != nutritionistId)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var response = GetPlanResponse.FromDocument(plan);

        // ── MealLog fold-in ──────────────────────────────────────────────────────
        // Query MealLogs by PlanId only. Ownership is already validated above
        // (plan.NutritionistId == nutritionistId), so there is no IDOR risk here.
        //
        // A meal is considered eaten iff MealLog.EatenAt != null.
        // MealLog.EatenAt == null means the log is a photo-only or note-only stub
        // and is NOT treated as eaten (disambiguation rule per issue #329).
        var logFilter = Builders<MealLog>.Filter.Eq(l => l.PlanId, req.PlanId);
        var logCursor = await mongo.MealLogs.FindAsync(logFilter, cancellationToken: ct);
        var mealLogs = await logCursor.ToListAsync(ct);

        response.MealLogs = mealLogs
            .Select(l => new MealLogDto
            {
                MealId = l.MealId,
                LogDate = DateOnly.FromDateTime(l.LogDate),
                IsEaten = l.EatenAt.HasValue,
                EatenAt = l.EatenAt
            })
            .ToList();

        await Send.OkAsync(response, ct);
    }
}
