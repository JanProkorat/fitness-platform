using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for the full-state <see cref="UpdatePlanEndpoint"/>.
/// </summary>
public class UpdatePlanFullStateTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    private UpdatePlanEndpoint CreateEndpoint(IMongoContext mongo, IMacroCalculatorService macroCalc) =>
        Factory.Create<UpdatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo,
            macroCalc);

    private static UpdateWeekRequest BuildWeekRequest(int weekNumber, MealFood? food = null)
    {
        var mealFoods = food is not null
            ? new List<UpdateMealFoodRequest>
            {
                new()
                {
                    FoodExternalId = food.FoodExternalId,
                    FoodName = food.FoodName,
                    NutrientValuePer100Grams = food.NutrientValuePer100Grams,
                    AmountGrams = food.AmountGrams
                }
            }
            : [];

        return new UpdateWeekRequest
        {
            WeekNumber = weekNumber,
            Days = Enumerable.Range(1, 7).Select(d => new UpdateDayRequest
            {
                DayOfWeek = d,
                Meals =
                [
                    new UpdateMealRequest
                    {
                        Name = "Breakfast",
                        Order = 1,
                        Foods = mealFoods
                    }
                ]
            }).ToList()
        };
    }

    [Fact]
    public async Task HandleAsync_ValidFullState_UpdatesPlan()
    {
        var planId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Apple");
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 1);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1, food: food)]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        macroCalc.Received(1).RecalculateTotals(Arg.Is<NutritionPlan>(p => p.Name == "Updated Plan"));

        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p => p.Name == "Updated Plan" && p.Version == 2),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_VersionMismatch_Returns409()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 2);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        // Send request with version 1, but plan is at version 2
        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1)]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_RemovePublishedWeek_ThrowsError()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 2,
            version: 1);

        // Mark week 1 as Published
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = DateTime.UtcNow;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        // Send only week 2 — week 1 (Published) is omitted
        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 2)]
        };

        var act = () => ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        var req = new UpdatePlanRequest
        {
            PlanId = Guid.NewGuid(),
            Name = "Ghost Plan",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1)]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_PreservesPublishedWeekStatus()
    {
        var planId = Guid.NewGuid();
        var datePublished = DateTime.UtcNow.AddDays(-1);
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 2,
            version: 1);

        // Set week 1 to Published with a known DatePublished
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = datePublished;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        // Send both weeks in the update
        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Still Active Plan",
            Version = 1,
            Weeks =
            [
                BuildWeekRequest(weekNumber: 1),
                BuildWeekRequest(weekNumber: 2)
            ]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p =>
                p.Status == NutritionPlanStatus.Active &&
                p.Weeks.First(w => w.WeekNumber == 1).Status == WeekStatus.Published &&
                p.Weeks.First(w => w.WeekNumber == 1).DatePublished == datePublished),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }
}
