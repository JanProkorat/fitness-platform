using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.DeleteMeal;

/// <summary>
/// Deletes a meal from a specific day within a nutrition plan week.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="macroCalculator">Service for recalculating plan totals.</param>
public class DeleteMealEndpoint(IMongoContext mongo, IMacroCalculatorService macroCalculator)
    : Endpoint<DeleteMealRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/nutrition/plans/{PlanId}/weeks/{WeekNumber}/days/{DayOfWeek}/meals/{MealId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Delete meal from plan day";
            s.Description = "Removes a meal from the specified day within a nutrition plan week.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteMealRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
            & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);
        using var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == req.WeekNumber);

        if (week is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var day = week.Days.FirstOrDefault(d => d.DayOfWeek == req.DayOfWeek);

        if (day is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var meal = day.Meals.FirstOrDefault(m => m.MealId == req.MealId);

        if (meal is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        day.Meals.Remove(meal);

        macroCalculator.RecalculateTotals(plan);

        plan.Version++;
        plan.DateUpdated = DateTime.UtcNow;
        await mongo.NutritionPlans.ReplaceOneAsync(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, plan.ExternalId),
            plan, cancellationToken: ct);

        await Send.NoContentAsync(ct);
    }
}
