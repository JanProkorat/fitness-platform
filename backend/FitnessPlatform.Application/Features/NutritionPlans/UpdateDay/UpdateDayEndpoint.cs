using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdateDay;

/// <summary>
/// Replaces all meals for a specific day within a nutrition plan week.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="macroCalculator">Service for recalculating plan totals.</param>
public class UpdateDayEndpoint(IMongoContext mongo, IMacroCalculatorService macroCalculator)
    : Endpoint<UpdateDayRequest, PlanDay>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/nutrition/plans/{PlanId}/weeks/{WeekNumber}/days/{DayOfWeek}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Update plan day";
            s.Description = "Replaces all meals for the specified day within a nutrition plan week.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateDayRequest req, CancellationToken ct)
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

        // Replace the entire day's meals with the request data
        day.Meals = req.Meals.Select(m => new PlanMeal
        {
            MealId = m.MealId,
            Name = m.Name,
            Order = m.Order,
            Time = m.Time,
            Foods = m.Foods.Select(f => new MealFood
            {
                FoodExternalId = f.FoodExternalId,
                FoodName = f.FoodName,
                NutrientValuePer100Grams = new NutrientValue
                {
                    Kcal = f.NutrientValuePer100Grams.Kcal,
                    Protein = f.NutrientValuePer100Grams.Protein,
                    Carbs = f.NutrientValuePer100Grams.Carbs,
                    Fat = f.NutrientValuePer100Grams.Fat,
                    Fiber = f.NutrientValuePer100Grams.Fiber,
                    Sugar = f.NutrientValuePer100Grams.Sugar,
                    SaturatedFat = f.NutrientValuePer100Grams.SaturatedFat,
                    Salt = f.NutrientValuePer100Grams.Salt
                },
                AmountGrams = f.AmountGrams
            }).ToList()
        }).ToList();

        macroCalculator.RecalculateTotals(plan);

        plan.Version++;
        plan.DateUpdated = DateTime.UtcNow;
        await mongo.NutritionPlans.ReplaceOneAsync(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, plan.ExternalId),
            plan, cancellationToken: ct);

        await Send.OkAsync(day, ct);
    }
}
