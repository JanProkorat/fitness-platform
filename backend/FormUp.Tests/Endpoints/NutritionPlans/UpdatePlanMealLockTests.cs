using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FluentAssertions;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Domain.Services;
using FormUp.Application.Features.NutritionPlans.UpdatePlan;
using FormUp.Application.Infrastructure.Data.MongoDb;
using FormUp.Tests.Builders;
using MongoDB.Bson;
using NSubstitute;

namespace FormUp.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Meal lock rules of <see cref="UpdatePlanEndpoint"/>: eaten, partly eaten and past-day meals.
/// The plan starts Monday 2026-11-02 and the fixed clock reads Thursday 2026-11-05 12:00 UTC, so
/// Monday to Wednesday (days 1-3) are past, Thursday (day 4) is today and Friday (day 5) is ahead.
/// </summary>
public class UpdatePlanMealLockTests
{
    private const int PastDay = 3;
    private const int TodayDay = 4;
    private const int FutureDay = 5;

    private static readonly DateTime PlanStart = new(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTimeOffset FixedNow = new(2026, 11, 5, 12, 0, 0, TimeSpan.Zero);

    private readonly Guid _nutritionistId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _todayMealId = Guid.NewGuid();
    private readonly Guid _futureMealId = Guid.NewGuid();
    private readonly Guid _pastMealId = Guid.NewGuid();
    private readonly Guid _foodRef = Guid.NewGuid();
    private readonly Guid _recipeRef = Guid.NewGuid();

    private NutritionPlan BuildPlan()
    {
        var plan = PlanTestHelpers.CreatePlan(externalId: _planId, nutritionistId: _nutritionistId, weekCount: 1, version: 1);
        plan.StartDate = PlanStart;
        plan.Weeks[0].Days[TodayDay - 1].Meals =
        [
            new PlanMeal
            {
                MealId = _todayMealId,
                Kind = MealKind.Lunch,
                Order = 1,
                Time = "12:00",
                Note = "stored note",
                Foods = [new MealFood { ItemId = Guid.NewGuid(), FoodExternalId = _foodRef, FoodName = "Rice", AmountGrams = 150, Note = "food note" }],
                Recipes = [new MealRecipe { ItemId = Guid.NewGuid(), RecipeId = _recipeRef, RecipeName = "Bowl", Servings = 1, Note = "recipe note" }],
            },
        ];
        plan.Weeks[0].Days[FutureDay - 1].Meals =
        [
            new PlanMeal
            {
                MealId = _futureMealId,
                Kind = MealKind.Dinner,
                Order = 1,
                Foods = [new MealFood { ItemId = Guid.NewGuid(), FoodExternalId = Guid.NewGuid(), FoodName = "Fish", AmountGrams = 200 }],
            },
        ];
        plan.Weeks[0].Days[PastDay - 1].Meals =
        [
            new PlanMeal
            {
                MealId = _pastMealId,
                Kind = MealKind.Breakfast,
                Order = 1,
                Foods = [new MealFood { ItemId = Guid.NewGuid(), FoodExternalId = Guid.NewGuid(), FoodName = "Oats", AmountGrams = 60 }],
            },
        ];

        return plan;
    }

    private MealLog EatenLog(Guid mealId, DateOnly day) =>
        PlanTestHelpers.CreateMealLog(
            _planId, mealId, day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            eatenAt: day.ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc));

    private static UpdateMealRequest EchoMeal(PlanMeal meal) => new()
    {
        MealId = meal.MealId,
        Kind = meal.Kind,
        Order = meal.Order,
        Time = meal.Time,
        Note = meal.Note,
        Foods = meal.Foods.Select(food => new UpdateMealFoodRequest
        {
            ItemId = food.ItemId,
            FoodExternalId = food.FoodExternalId,
            FoodName = food.FoodName,
            AmountGrams = food.AmountGrams,
            Note = food.Note,
        }).ToList(),
        Recipes = meal.Recipes.Select(recipe => new UpdateMealRecipeRequest
        {
            ItemId = recipe.ItemId,
            RecipeId = recipe.RecipeId,
            RecipeName = recipe.RecipeName,
            Servings = recipe.Servings,
            Note = recipe.Note,
        }).ToList(),
    };

    private static UpdatePlanRequest EchoRequest(NutritionPlan plan, Guid planId, int version = 1, bool preserve = false) => new()
    {
        PlanId = planId,
        Name = plan.Name,
        Version = version,
        StartDate = plan.StartDate,
        PreserveLockedMeals = preserve,
        Weeks = plan.Weeks.Select(week => new UpdateWeekRequest
        {
            WeekNumber = week.WeekNumber,
            Days = week.Days.Select(day => new UpdateDayRequest
            {
                DayOfWeek = day.DayOfWeek,
                Meals = day.Meals.Select(EchoMeal).ToList(),
            }).ToList(),
        }).ToList(),
    };

    private static UpdateDayRequest Day(UpdatePlanRequest req, int dayOfWeek) => req.Weeks[0].Days[dayOfWeek - 1];

    private static UpdateMealRequest FreshMeal() => new()
    {
        Kind = MealKind.AfternoonSnack,
        Order = 1,
        Foods = [new UpdateMealFoodRequest { FoodExternalId = Guid.NewGuid(), FoodName = "Nuts", AmountGrams = 30 }],
    };

    private async Task<(int Status, string? ErrorCode, UpdatePlanEndpoint Endpoint)> RunAsync(
        NutritionPlan plan,
        UpdatePlanRequest req,
        MealLog[]? logs = null,
        string? clientTimeZone = null,
        DateTimeOffset? now = null,
        IClientLinkAuthorizationService? link = null)
    {
        using var responseBody = new MemoryStream();
        var db = new MockDbBuilder()
            .With(new ApplicationUser { Id = plan.ClientId, TimeZone = clientTimeZone ?? "UTC" })
            .Build();
        var ep = Factory.Create<UpdatePlanEndpoint>(
            ctx =>
            {
                ctx.Request.HttpContext.User = new ClaimsPrincipal(
                    new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist)));
                ctx.Request.HttpContext.Response.Body = responseBody;
            },
            PlanTestHelpers.CreateMockMongo(plans: [plan], mealLogs: logs),
            Substitute.For<IMacroCalculatorService>(),
            db,
            Substitute.For<IRealtimeNotifier>(),
            new PlanConcurrencyGuard(),
            link ?? EndpointTestHelpers.CreateGrantingLinkAuthorizationService(),
            new FixedTimeProvider(now ?? FixedNow));

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        string? errorCode = null;
        if (ep.HttpContext.Response.StatusCode == 409)
        {
            responseBody.Seek(0, SeekOrigin.Begin);
            using var doc = await JsonDocument.ParseAsync(responseBody, cancellationToken: TestContext.Current.CancellationToken);
            errorCode = doc.RootElement.GetProperty("errorCode").GetString();
        }

        return (ep.HttpContext.Response.StatusCode, errorCode, ep);
    }

    [Theory]
    [InlineData("kind")]
    [InlineData("time")]
    [InlineData("note")]
    [InlineData("foodAmount")]
    [InlineData("foodNote")]
    [InlineData("recipeServings")]
    [InlineData("recipeNote")]
    [InlineData("addFood")]
    public async Task HandleAsync_EatenMealChanged_Returns409MealLocked_AndPlanIsUntouched(string change)
    {
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId);
        var meal = Day(req, TodayDay).Meals.Single();

        switch (change)
        {
            case "kind": meal.Kind = MealKind.AfternoonSnack; break;
            case "time": meal.Time = "13:00"; break;
            case "note": meal.Note = "changed"; break;
            case "foodAmount": meal.Foods[0].AmountGrams = 151; break;
            case "foodNote": meal.Foods[0].Note = "changed"; break;
            case "recipeServings": meal.Recipes[0].Servings = 2; break;
            case "recipeNote": meal.Recipes[0].Note = "changed"; break;
            default: meal.Foods.Add(new UpdateMealFoodRequest { FoodExternalId = Guid.NewGuid(), AmountGrams = 10 }); break;
        }

        var result = await RunAsync(plan, req, [EatenLog(_todayMealId, new DateOnly(2026, 11, 5))]);

        result.Status.Should().Be(409);
        result.ErrorCode.Should().Be(ErrorCodes.MealLocked);
        plan.Version.Should().Be(1);
        plan.Weeks[0].Days[TodayDay - 1].Meals.Single().Foods[0].AmountGrams.Should().Be(150);
    }

    [Fact]
    public async Task HandleAsync_PartlyEatenMealChanged_Returns409MealLocked()
    {
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId);
        Day(req, TodayDay).Meals.Single().Foods[0].AmountGrams = 99;
        var partlyEaten = PlanTestHelpers.CreateMealLog(_planId, _todayMealId, new DateTime(2026, 11, 5, 0, 0, 0, DateTimeKind.Utc));
        partlyEaten.EatenItemIds = [plan.Weeks[0].Days[TodayDay - 1].Meals[0].Foods[0].ItemId];

        var result = await RunAsync(plan, req, [partlyEaten]);

        result.Status.Should().Be(409);
        result.ErrorCode.Should().Be(ErrorCodes.MealLocked);
    }

    [Theory]
    [InlineData(TodayDay, true)]
    [InlineData(PastDay, false)]
    public async Task HandleAsync_LockedMealOmitted_Returns409MealLocked(int day, bool eaten)
    {
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId);
        Day(req, day).Meals.Clear();
        MealLog[] logs = eaten ? [EatenLog(_todayMealId, new DateOnly(2026, 11, 5))] : [];

        var result = await RunAsync(plan, req, logs);

        result.Status.Should().Be(409);
        result.ErrorCode.Should().Be(ErrorCodes.MealLocked);
    }

    [Fact]
    public async Task HandleAsync_LockedMealMovedToAnotherDay_Returns409MealLocked()
    {
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId);
        var meal = Day(req, TodayDay).Meals.Single();
        Day(req, TodayDay).Meals.Clear();
        Day(req, FutureDay).Meals.Add(meal);

        var result = await RunAsync(plan, req, [EatenLog(_todayMealId, new DateOnly(2026, 11, 5))]);

        result.Status.Should().Be(409);
        result.ErrorCode.Should().Be(ErrorCodes.MealLocked);
    }

    [Fact]
    public async Task HandleAsync_NeverEatenMealOnYesterdayChanged_Returns409MealLocked()
    {
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId);
        Day(req, PastDay).Meals.Single().Foods[0].AmountGrams = 10;

        var result = await RunAsync(plan, req);

        result.Status.Should().Be(409);
        result.ErrorCode.Should().Be(ErrorCodes.MealLocked);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task HandleAsync_MealAddedOrMovedOntoPastDay_Returns409PastDayLocked(bool moveUnlockedMeal)
    {
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId);
        var placed = FreshMeal();

        if (moveUnlockedMeal)
        {
            placed = Day(req, FutureDay).Meals.Single();
            Day(req, FutureDay).Meals.Clear();
        }

        Day(req, 1).Meals.Add(placed);

        var result = await RunAsync(plan, req);

        result.Status.Should().Be(409);
        result.ErrorCode.Should().Be(ErrorCodes.PastDayLocked);
    }

    [Fact]
    public async Task HandleAsync_StaleVersionWithLockViolation_ReturnsVersionConflict()
    {
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId, version: 0);
        Day(req, PastDay).Meals.Clear();

        var result = await RunAsync(plan, req);

        result.Status.Should().Be(409);
        result.ErrorCode.Should().Be(ErrorCodes.PlanVersionConflict);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task HandleAsync_MealNoLongerEaten_CanBeEdited(bool rowStillThereButUnticked)
    {
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId);
        Day(req, TodayDay).Meals.Single().Foods[0].AmountGrams = 99;
        var logs = rowStillThereButUnticked
            ? new[] { PlanTestHelpers.CreateMealLog(_planId, _todayMealId, new DateTime(2026, 11, 5, 0, 0, 0, DateTimeKind.Utc)) }
            : [];

        var result = await RunAsync(plan, req, logs);

        result.Status.Should().Be(200);
        plan.Weeks[0].Days[TodayDay - 1].Meals.Single().Foods[0].AmountGrams.Should().Be(99);
    }

    [Theory]
    [InlineData("Pacific/Auckland", 409)]
    [InlineData(null, 200)]
    public async Task HandleAsync_ClientLocalDayDecidesWhetherADayIsPast(string? clientTimeZone, int expectedStatus)
    {
        // 2026-11-04 23:30 UTC is already Thursday 12:30 in Auckland, so Wednesday is past there only.
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId);
        Day(req, PastDay).Meals.Single().Foods[0].AmountGrams = 10;

        var result = await RunAsync(
            plan, req, clientTimeZone: clientTimeZone, now: new DateTimeOffset(2026, 11, 4, 23, 30, 0, TimeSpan.Zero));

        result.Status.Should().Be(expectedStatus);
    }

    [Fact]
    public async Task HandleAsync_PreserveLockedMeals_KeepsLockedAndPastMealsAndAppliesTheRest()
    {
        var plan = BuildPlan();
        var storedToday = plan.Weeks[0].Days[TodayDay - 1].Meals.Single().ToBsonDocument();
        var storedPast = plan.Weeks[0].Days[PastDay - 1].Meals.Single().ToBsonDocument();

        // A template applied in the browser: fresh ids everywhere, nothing of the locked meals echoed.
        var req = EchoRequest(plan, _planId, preserve: true);
        foreach (var day in req.Weeks[0].Days)
        {
            day.Meals.Clear();
        }

        Day(req, 1).Meals.Add(FreshMeal());
        Day(req, PastDay).Meals.Add(FreshMeal());
        Day(req, TodayDay).Meals.Add(FreshMeal());
        Day(req, FutureDay).Meals.Add(FreshMeal());
        var futureTemplateMealKind = Day(req, FutureDay).Meals.Single().Kind;

        var result = await RunAsync(plan, req, [EatenLog(_todayMealId, new DateOnly(2026, 11, 5))]);

        result.Status.Should().Be(200);
        var days = plan.Weeks[0].Days;
        days[0].Meals.Should().BeEmpty("incoming meals on a past day are dropped");
        days[PastDay - 1].Meals.Should().ContainSingle();
        days[PastDay - 1].Meals[0].ToBsonDocument().Equals(storedPast).Should().BeTrue("a past-day meal is kept byte-identical");
        days[TodayDay - 1].Meals.Should().HaveCount(2);
        days[TodayDay - 1].Meals.Single(meal => meal.MealId == _todayMealId).ToBsonDocument()
            .Equals(storedToday).Should().BeTrue("an eaten meal is kept byte-identical");
        days[FutureDay - 1].Meals.Should().ContainSingle().Which.Kind.Should().Be(futureTemplateMealKind);
        days[FutureDay - 1].Meals.Should().NotContain(meal => meal.MealId == _futureMealId);
    }

    [Fact]
    public async Task HandleAsync_PreserveLockedMealsAndPayloadOmitsLockedDays_RestoresThem()
    {
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId, preserve: true);
        req.Weeks[0].Days.RemoveAll(day => day.DayOfWeek is PastDay or TodayDay);

        var result = await RunAsync(plan, req, [EatenLog(_todayMealId, new DateOnly(2026, 11, 5))]);

        result.Status.Should().Be(200);
        plan.Weeks[0].Days.Single(day => day.DayOfWeek == PastDay).Meals.Single().MealId.Should().Be(_pastMealId);
        plan.Weeks[0].Days.Single(day => day.DayOfWeek == TodayDay).Meals.Single().MealId.Should().Be(_todayMealId);
        plan.Weeks[0].Days.Select(day => day.DayOfWeek).Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task HandleAsync_UnchangedLockedMealEchoedWithDifferentOrder_IsAcceptedAndKeptAsStored()
    {
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId);
        Day(req, TodayDay).Meals.Single().Order = 2;
        var added = FreshMeal();
        added.Order = 1;
        Day(req, TodayDay).Meals.Insert(0, added);

        var result = await RunAsync(plan, req, [EatenLog(_todayMealId, new DateOnly(2026, 11, 5))]);

        result.Status.Should().Be(200);
        var meals = plan.Weeks[0].Days[TodayDay - 1].Meals;
        meals.Should().HaveCount(2);
        meals.Single(meal => meal.MealId == _todayMealId).Order.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_LinkLostNutritionAccess_Returns404BeforeAnyLockLogic()
    {
        var plan = BuildPlan();
        var req = EchoRequest(plan, _planId);
        Day(req, PastDay).Meals.Clear();

        var result = await RunAsync(plan, req, link: PlanTestHelpers.CreateDenyingLinkAuthorizationService());

        result.Status.Should().Be(404);
        result.ErrorCode.Should().BeNull();
    }
}
