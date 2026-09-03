using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.GetTodayLog;
using FitnessPlatform.Application.Features.ClientNutrition.GetTodayPlan;
using FitnessPlatform.Application.Features.ClientNutrition.GetWeekPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Infrastructure;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GetTodayLogEndpoint"/>.
/// </summary>
public class GetTodayLogEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    /// <summary>
    /// Shared fake so tests can assert on <see cref="FakeBlobStorageService.SignedUrlRequests"/> —
    /// which stored BlobUrls were routed through signing before the response was sent (F9).
    /// </summary>
    private readonly FakeBlobStorageService _blobStorage = new();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    [Fact]
    public async Task HandleAsync_WithLogs_ReturnsTotals()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(
            foodName: "Chicken",
            amountGrams: 200,
            kcal: 165,
            protein: 31,
            carbs: 0,
            fat: 3.6m);
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Lunch, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            globalSettings: new GlobalNutritionSettings
            {
                DailyKcal = 2000,
                ProteinGrams = 150,
                CarbsGrams = 250,
                FatGrams = 60
            });
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var logs = new List<MealLog>
        {
            new()
            {
                ClientId = _clientId,
                PlanId = plan.ExternalId,
                MealId = mealId,
                EatenAt = DateTime.UtcNow,
                FoodsEaten = [food]
            }
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        // Mock MealLogs collection
        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor(logs));
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _blobStorage, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.MealsEaten.Should().HaveCount(1);
        ep.Response.MealsEaten[0].MealName.Should().Be("Lunch");

        // 200g chicken at 165kcal/100g = 330 kcal
        ep.Response.TotalConsumed.Kcal.Should().Be(330m);
        // 200g at 31g protein/100g = 62
        ep.Response.TotalConsumed.Protein.Should().Be(62m);

        ep.Response.Remaining.Should().NotBeNull();
        ep.Response.Remaining!.Kcal.Should().Be(2000m - 330m);
    }

    [Fact]
    public async Task HandleAsync_NoLogs_ReturnsEmptyTotals()
    {
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor([]));
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _blobStorage, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.MealsEaten.Should().BeEmpty();
        ep.Response.TotalConsumed.Kcal.Should().Be(0);
        ep.Response.TotalConsumed.Protein.Should().Be(0);
    }

    [Fact]
    public async Task HandleAsync_LogWithPhotosAndNote_RoundTripsInResponse()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Salmon", amountGrams: 150, kcal: 208);
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Dinner, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var uploadedAt = DateTime.UtcNow.AddMinutes(-5);
        var log = new MealLog
        {
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = mealId,
            EatenAt = DateTime.UtcNow,
            FoodsEaten = [food],
            Photos =
            [
                new MealPhoto { BlobUrl = "https://minio.local/bucket/photo1.jpg", UploadedAt = uploadedAt },
                new MealPhoto { BlobUrl = "https://minio.local/bucket/photo2.jpg", UploadedAt = uploadedAt }
            ],
            Note = "Great post-workout dinner"
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor([log]));
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _blobStorage, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.MealsEaten.Should().HaveCount(1);

        var dto = ep.Response.MealsEaten[0];
        dto.Photos.Should().HaveCount(2);

        // Positive control: both stored BlobUrls reached the signing call verbatim.
        _blobStorage.SignedUrlRequests.Should().Contain("https://minio.local/bucket/photo1.jpg");
        _blobStorage.SignedUrlRequests.Should().Contain("https://minio.local/bucket/photo2.jpg");

        // Negative control: DisplayUrl carries the signed marker — the bucket no longer grants
        // public read on diary/* (F9) — while BlobUrl stays the canonical, permanent identity
        // value so a client can safely echo it back on a later SaveMealPhotos call.
        dto.Photos[0].DisplayUrl.Should().Be("https://minio.local/bucket/photo1.jpg?signed=test");
        dto.Photos[0].BlobUrl.Should().Be("https://minio.local/bucket/photo1.jpg");
        dto.Photos[0].UploadedAt.Should().Be(uploadedAt);
        dto.Photos[1].DisplayUrl.Should().Be("https://minio.local/bucket/photo2.jpg?signed=test");
        dto.Note.Should().Be("Great post-workout dinner");
    }

    [Fact]
    public async Task HandleAsync_LogWithoutPhotosOrNote_ReturnsEmptyPhotosAndNullNote()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Toast");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var log = new MealLog
        {
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = mealId,
            EatenAt = DateTime.UtcNow,
            FoodsEaten = [food]
            // No Photos, no Note — represents a legacy or quick-log entry
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor([log]));
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _blobStorage, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.MealsEaten.Should().HaveCount(1);

        var dto = ep.Response.MealsEaten[0];
        dto.Photos.Should().BeEmpty();
        dto.Note.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_PhotoOnlyLog_NullEatenAt_AppearsInResponse()
    {
        // Regression: GetTodayLog previously filtered by EatenAt >= today which excluded
        // photo-only logs whose EatenAt is null. Verify the endpoint now returns them.
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Yoghurt");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.AfternoonSnack, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var uploadedAt = DateTime.UtcNow.AddMinutes(-10);
        // Photo-only log: no EatenAt, LogDate = today, created by SaveMealPhotos
        var photoOnlyLog = new MealLog
        {
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = mealId,
            LogDate = DateTime.UtcNow.Date,
            EatenAt = null,
            FoodsEaten = [food],
            Photos = [new MealPhoto { BlobUrl = "https://minio.local/bucket/snack.jpg", UploadedAt = uploadedAt }],
            Note = "afternoon snack photo"
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor([photoOnlyLog]));
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _blobStorage, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.MealsEaten.Should().HaveCount(1);

        var dto = ep.Response.MealsEaten[0];
        dto.EatenAt.Should().BeNull();
        dto.Photos.Should().HaveCount(1);
        dto.Photos[0].DisplayUrl.Should().Be("https://minio.local/bucket/snack.jpg?signed=test");
        dto.Photos[0].BlobUrl.Should().Be("https://minio.local/bucket/snack.jpg");
        dto.Photos[0].UploadedAt.Should().Be(uploadedAt);
        dto.Note.Should().Be("afternoon snack photo");
    }

    [Fact]
    public async Task HandleAsync_PhotoWithNote_PopulatesMealPhotoDtoNote()
    {
        // A MealPhoto that carries a per-photo Note must surface in the MealPhotoDto.Note field.
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Smoothie");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.MorningSnack, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var uploadedAt = DateTime.UtcNow.AddMinutes(-15);
        var log = new MealLog
        {
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = mealId,
            LogDate = DateTime.UtcNow.Date,
            EatenAt = null,
            FoodsEaten = [food],
            Photos =
            [
                new MealPhoto
                {
                    BlobUrl = "https://minio.local/bucket/smoothie.jpg",
                    UploadedAt = uploadedAt,
                    Note = "Blueberry variant"
                },
                new MealPhoto
                {
                    BlobUrl = "https://minio.local/bucket/smoothie2.jpg",
                    UploadedAt = uploadedAt,
                    Note = null
                }
            ],
            Note = null
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor([log]));
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _blobStorage, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.MealsEaten.Should().HaveCount(1);

        var dto = ep.Response.MealsEaten[0];
        dto.Photos.Should().HaveCount(2);
        dto.Photos[0].DisplayUrl.Should().Be("https://minio.local/bucket/smoothie.jpg?signed=test");
        dto.Photos[0].BlobUrl.Should().Be("https://minio.local/bucket/smoothie.jpg");
        dto.Photos[0].Note.Should().Be("Blueberry variant");
        dto.Photos[1].DisplayUrl.Should().Be("https://minio.local/bucket/smoothie2.jpg?signed=test");
        dto.Photos[1].Note.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            mongo, db, _blobStorage, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    /// <summary>
    /// Regression guard for #850's rework: <see cref="GetTodayLogEndpoint"/> and
    /// <see cref="GetTodayPlanEndpoint"/> (and, cheaply in the same fixture,
    /// <see cref="GetWeekPlanEndpoint"/>) must resolve the SAME week for a legacy (no-StartDate)
    /// plan whose published weeks carry a duplicate weekNumber — wn=1 "A", wn=1 "B", wn=2 "C".
    /// </summary>
    /// <remarks>
    /// Publish date is 14 days ago, landing on <c>weekIndex == 0</c> of the DEDUPED 2-distinct-week
    /// list (a full 14-day cycle wraps back to wn=1 "A") but <c>weekIndex == 2</c> of the RAW
    /// 3-element list (<c>14 / 7 == 2</c>), which resolves wn=2 "C" instead — the same
    /// pre-fix/post-fix divergence proven for <c>GetTodayPlanEndpoint</c> in
    /// <c>GetTodayPlanProjectionIntegrationTests.GetTodayPlan_LegacyPlanWithDuplicateWeekNumbers_CyclesOnDedupedWeekCount</c>.
    /// A meal is logged against wn=1 "A"'s <c>PlanMeal</c>, which carries a pre-computed
    /// <c>MealTotals</c> (999 kcal) distinct from what <c>CalculateTotals</c> would compute off the
    /// logged <c>FoodsEaten</c> snapshot (50 kcal). If <see cref="GetTodayLogEndpoint"/> resolved
    /// the WRONG week (wn=2 "C", which only contains a different MealId), the lookup would miss,
    /// <c>MealName</c> would come back empty, and totals would silently fall back to the 50-kcal
    /// FoodsEaten calc — exactly the data-loss failure mode this fix closes.
    /// </remarks>
    [Fact]
    public async Task HandleAsync_LegacyPlanWithDuplicateWeekNumbers_AgreesWithGetTodayPlanAndGetWeekPlan()
    {
        var datePublished = DateTime.UtcNow.Date.AddDays(-14);

        var weekOneAMealId = Guid.NewGuid();
        var weekOneBMealId = Guid.NewGuid();
        var weekTwoMealId = Guid.NewGuid();

        var weekOneAMeal = PlanTestHelpers.CreateMeal(mealId: weekOneAMealId, kind: MealKind.Lunch);
        weekOneAMeal.MealTotals = new NutrientTotals { Kcal = 999m, Protein = 99m, Carbs = 99m, Fat = 99m };
        var weekOneBMeal = PlanTestHelpers.CreateMeal(mealId: weekOneBMealId, kind: MealKind.Dinner);
        var weekTwoMeal = PlanTestHelpers.CreateMeal(mealId: weekTwoMealId, kind: MealKind.Breakfast);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 0);
        plan.StartDate = null;
        plan.DatePublished = datePublished;
        plan.Weeks =
        [
            BuildLegacyWeek(1, datePublished, weekOneAMeal),
            BuildLegacyWeek(1, datePublished, weekOneBMeal),
            BuildLegacyWeek(2, datePublished, weekTwoMeal)
        ];

        // A distinguishing 50-kcal fallback food: only reached if the endpoint misses the plan
        // meal (wrong week resolved) and falls back to CalculateTotals(log.FoodsEaten).
        var fallbackFood = PlanTestHelpers.CreateMealFood(
            foodName: "Fallback Food", amountGrams: 100, kcal: 50, protein: 5, carbs: 5, fat: 2);
        var mealLog = PlanTestHelpers.CreateMealLog(
            planId: plan.ExternalId,
            mealId: weekOneAMealId,
            logDate: DateTime.UtcNow.Date,
            clientId: _clientId);
        mealLog.FoodsEaten = [fallbackFood];

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan], mealLogs: [mealLog]);
        var db = CreateMockDb();

        // ── GetTodayPlan: independently confirm which week it resolves ──
        var todayPlanEp = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);
        await todayPlanEp.HandleAsync(TestContext.Current.CancellationToken);

        todayPlanEp.Response.Should().NotBeNull();
        todayPlanEp.Response.WeekNumber.Should().Be(1,
            "the deduped cycle (14 days over a 2-distinct-week plan) must resolve wn=1 \"A\"");
        todayPlanEp.Response.Meals.Should().ContainSingle(m => m.MealId == weekOneAMealId);

        // ── GetWeekPlan: cheap to check in the same fixture — must agree too ──
        var weekPlanEp = Factory.Create<GetWeekPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);
        await weekPlanEp.HandleAsync(TestContext.Current.CancellationToken);

        weekPlanEp.Response.Should().NotBeNull();
        weekPlanEp.Response.WeekNumber.Should().Be(1,
            "GetWeekPlan must resolve the SAME deduped wn=1 \"A\" week as GetTodayPlan");

        // ── GetTodayLog: must resolve the SAME week — the concrete data-loss consequence ──
        var todayLogEp = Factory.Create<GetTodayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _blobStorage);
        await todayLogEp.HandleAsync(TestContext.Current.CancellationToken);

        todayLogEp.Response.Should().NotBeNull();
        todayLogEp.Response.MealsEaten.Should().ContainSingle();
        var loggedMeal = todayLogEp.Response.MealsEaten[0];
        loggedMeal.MealName.Should().Be("Lunch",
            "GetTodayLog must resolve the SAME wn=1 \"A\" week as GetTodayPlan and find the logged " +
            "meal there — an empty name means the raw-index lookup missed it in a different week");
        loggedMeal.Totals.Kcal.Should().Be(999m,
            "the plan meal's pre-computed MealTotals must be used once found — a fallback to the " +
            "50-kcal FoodsEaten calc means the endpoint resolved the WRONG week (wn=2 \"C\") and " +
            "never found the wn=1 \"A\" plan meal to key off");
    }

    /// <summary>
    /// Builds a published <see cref="PlanWeek"/> with 7 days; only day index 0 carries the given
    /// meal, so the legacy dayIndex-0 selection in the cross-endpoint agreement test above always
    /// lands on it.
    /// </summary>
    private static PlanWeek BuildLegacyWeek(int weekNumber, DateTime datePublished, PlanMeal mealAtDayZero)
    {
        var days = Enumerable.Range(1, 7).Select(d => new PlanDay { DayOfWeek = d, Meals = [] }).ToList();
        days[0].Meals.Add(mealAtDayZero);

        return new PlanWeek
        {
            WeekNumber = weekNumber,
            Status = WeekStatus.Published,
            DatePublished = datePublished,
            Days = days
        };
    }

    private static IAsyncCursor<MealLog> CreateMealLogCursor(List<MealLog> logs)
    {
        var cursor = Substitute.For<IAsyncCursor<MealLog>>();
        var moved = false;
        cursor.Current.Returns(logs);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return logs.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return logs.Count > 0;
        });
        return cursor;
    }
}
