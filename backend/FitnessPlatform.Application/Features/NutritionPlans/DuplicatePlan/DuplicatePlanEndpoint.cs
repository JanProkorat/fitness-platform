using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.DuplicatePlan;

/// <summary>
/// Creates a deep copy of an existing nutrition plan with a new identity and Draft status.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class DuplicatePlanEndpoint(IMongoContext mongo) : Endpoint<DuplicatePlanRequest, PlanSummaryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plans/{PlanId}/duplicate");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Duplicate a nutrition plan";
            s.Description = "Creates a deep copy of an existing plan with a new identity, all new meal IDs, and Draft status.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DuplicatePlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        // Find the source plan
        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId);
        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.NutritionistId != nutritionistId)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var now = DateTime.UtcNow;

        // Deep copy with new identifiers
        var copy = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = plan.ClientId,
            NutritionistId = nutritionistId,
            Name = req.Name ?? $"{plan.Name} (Copy)",
            Status = NutritionPlanStatus.Draft,
            GlobalSettings = plan.GlobalSettings is not null
                ? new GlobalNutritionSettings
                {
                    DailyKcal = plan.GlobalSettings.DailyKcal,
                    ProteinGrams = plan.GlobalSettings.ProteinGrams,
                    CarbsGrams = plan.GlobalSettings.CarbsGrams,
                    FatGrams = plan.GlobalSettings.FatGrams
                }
                : null,
            Weeks = plan.Weeks.Select(w => new PlanWeek
            {
                WeekNumber = w.WeekNumber,
                Days = w.Days.Select(d => new PlanDay
                {
                    DayOfWeek = d.DayOfWeek,
                    Meals = d.Meals.Select(m => new PlanMeal
                    {
                        MealId = Guid.NewGuid(),
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
                        }).ToList(),
                        MealTotals = m.MealTotals is not null
                            ? new NutrientTotals
                            {
                                Kcal = m.MealTotals.Kcal,
                                Protein = m.MealTotals.Protein,
                                Carbs = m.MealTotals.Carbs,
                                Fat = m.MealTotals.Fat
                            }
                            : null
                    }).ToList(),
                    DayTotals = d.DayTotals is not null
                        ? new NutrientTotals
                        {
                            Kcal = d.DayTotals.Kcal,
                            Protein = d.DayTotals.Protein,
                            Carbs = d.DayTotals.Carbs,
                            Fat = d.DayTotals.Fat
                        }
                        : null
                }).ToList()
            }).ToList(),
            Version = 1,
            DateCreated = now
        };

        await mongo.NutritionPlans.InsertOneAsync(copy, cancellationToken: ct);

        var response = PlanSummaryDto.FromDocument(copy);
        await HttpContext.Response.SendAsync(response, 201, cancellation: ct);
    }
}
