using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdateMeal;

/// <summary>
/// Updates an existing meal's name, order, and time within a nutrition plan day.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="macroCalculator">Service for recalculating plan totals.</param>
public class UpdateMealEndpoint(IMongoContext mongo, IMacroCalculatorService macroCalculator)
    : Endpoint<UpdateMealRequest, PlanMeal>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/nutrition/plans/{PlanId}/weeks/{WeekNumber}/days/{DayOfWeek}/meals/{MealId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Update meal in plan day";
            s.Description = "Updates the name, order, and time of an existing meal within a plan day.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateMealRequest req, CancellationToken ct)
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

        meal.Name = req.Name.Trim();
        meal.Order = req.Order;
        meal.Time = req.Time?.Trim();

        macroCalculator.RecalculateTotals(plan);

        plan.Version++;
        plan.DateUpdated = DateTime.UtcNow;
        await mongo.NutritionPlans.ReplaceOneAsync(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, plan.ExternalId),
            plan, cancellationToken: ct);

        await Send.OkAsync(meal, ct);
    }
}
