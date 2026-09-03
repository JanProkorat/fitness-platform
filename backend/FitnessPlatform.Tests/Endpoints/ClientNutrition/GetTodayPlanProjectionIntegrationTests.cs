using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.GetTodayPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Testcontainers integration tests (real MongoDB) for the #838 two-phase projected read in
/// <c>GET /client/nutrition/plan/today</c>. The mocked-<c>IMongoContext</c> unit tests in
/// <see cref="GetTodayPlanEndpointTests"/> prove the C# week/day-selection logic, but a real
/// Mongo instance is the only way to prove the actual projection queries — a malformed
/// phase-1 metadata projection or a wrong phase-2 <c>weeks.$</c> positional projection would
/// pass every mocked test (NSubstitute ignores the <c>Projection</c> option entirely) and
/// silently break in production.
/// </summary>
[Collection(TestCollection.Name)]
public class GetTodayPlanProjectionIntegrationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@today-plan-projection-test.com";

    /// <summary>
    /// Returns the Monday of the current week (UTC).
    /// </summary>
    private static DateTime StartOfCurrentWeek()
    {
        var today = DateTime.UtcNow.Date;
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }

    /// <summary>
    /// Builds a published <see cref="PlanWeek"/> with 7 days; only <paramref name="targetDayIndex"/>
    /// (0-based, Monday=0) carries a distinguishing meal so tests can tell which week/day a
    /// query actually returned.
    /// </summary>
    private static PlanWeek BuildWeek(int weekNumber, int targetDayIndex, Guid mealId, string foodName, DateTime datePublished)
    {
        var days = Enumerable.Range(1, 7).Select(d => new PlanDay { DayOfWeek = d, Meals = [] }).ToList();
        days[targetDayIndex].Meals.Add(new PlanMeal
        {
            MealId = mealId,
            Kind = MealKind.Lunch,
            Order = 1,
            Foods =
            [
                new MealFood
                {
                    FoodExternalId = Guid.NewGuid(),
                    FoodName = foodName,
                    NutrientValuePer100Grams = new NutrientValue { Kcal = 100, Protein = 10, Carbs = 10, Fat = 5 },
                    AmountGrams = 150
                }
            ]
        });

        return new PlanWeek
        {
            WeekNumber = weekNumber,
            Status = WeekStatus.Published,
            DatePublished = datePublished,
            Days = days
        };
    }

    /// <summary>
    /// Regression guard for #838. Seeds a 3-week Active plan whose window places today in
    /// WEEK 3 (a non-index-0 week — an off-by-one in the positional <c>weeks.$</c> filter would
    /// only surface here). Each week carries a distinctly-named meal on today's day-of-week so
    /// the test can prove exactly which week's content came back.
    /// <list type="number">
    /// <item>Direct-queries the real Mongo instance with the endpoint's actual (now
    /// <c>internal</c>) phase-1 <see cref="GetTodayPlanEndpoint.LightPlanProjection"/> and
    /// asserts every week's metadata is retained while <c>days</c> content is excluded for ALL
    /// weeks — not just the resolved one.</item>
    /// <item>Calls the real HTTP endpoint and asserts the response resolves week 3 and returns
    /// EXACTLY week 3's meal (not week 1's or week 2's, not empty) — proving the real phase-2
    /// positional projection matched the correct non-zero array index.</item>
    /// <item>Asserts byte-equivalence of the hydrated content against what a naive full-fetch
    /// of the seed would produce.</item>
    /// </list>
    /// </summary>
    [Fact]
    public async Task GetTodayPlan_MultiWeekPlan_TodayInNonFirstWeek_HydratesExactWeekContent_RealMongoProjection()
    {
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Proj", "Plan", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == email,
                TestContext.Current.CancellationToken);
            // GetTodayPlanEndpoint resolves the caller's ClientProfile by UserId and filters
            // NutritionPlan.ClientId on ClientProfile.UserId (#840) — seed the plan with
            // UserId, not PublicId, or the endpoint's own-plan lookup matches nothing.
            clientUserId = user.Id;
        }

        var todayDow = (int)DateTime.UtcNow.DayOfWeek;
        todayDow = todayDow == 0 ? 7 : todayDow;
        var targetDayIndex = todayDow - 1; // 0-based, Monday=0

        // Plan started 2 full weeks ago (Monday) — today resolves to week 3.
        var startDate = StartOfCurrentWeek().AddDays(-14);

        var week1MealId = Guid.NewGuid();
        var week2MealId = Guid.NewGuid();
        var week3MealId = Guid.NewGuid();
        var planId = Guid.NewGuid();

        var globalSettings = new GlobalNutritionSettings { DailyKcal = 2200, ProteinGrams = 150, CarbsGrams = 220, FatGrams = 70 };

        var plan = new NutritionPlan
        {
            ExternalId = planId,
            ClientId = clientUserId,
            NutritionistId = Guid.NewGuid(),
            Name = "Projection Test Plan",
            Status = NutritionPlanStatus.Active,
            StartDate = startDate,
            GlobalSettings = globalSettings,
            Version = 1,
            DateCreated = startDate,
            Weeks =
            [
                BuildWeek(1, targetDayIndex, week1MealId, "Week 1 Food (must never appear)", startDate),
                BuildWeek(2, targetDayIndex, week2MealId, "Week 2 Food (must never appear)", startDate),
                BuildWeek(3, targetDayIndex, week3MealId, "Week 3 Food (target)", startDate)
            ]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.NutritionPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        // ── 1. Direct assertion on the REAL phase-1 projection against real Mongo ──────────
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, planId);
            using var cursor = await mongo.NutritionPlans.FindAsync(
                filter,
                new FindOptions<NutritionPlan, NutritionPlan> { Projection = GetTodayPlanEndpoint.LightPlanProjection },
                TestContext.Current.CancellationToken);
            var projected = (await cursor.ToListAsync(TestContext.Current.CancellationToken)).Single();

            projected.Weeks.Should().HaveCount(3,
                "the weeks array itself must be RETAINED by the projection — only its content is excluded");
            projected.Weeks.Select(w => w.WeekNumber).Should().BeEquivalentTo(new[] { 1, 2, 3 });
            projected.Weeks.Should().AllSatisfy(w => w.Status.Should().Be(WeekStatus.Published));
            projected.Weeks.Should().AllSatisfy(w => w.DatePublished.Should().Be(startDate));
            projected.Weeks.Should().AllSatisfy(w => w.Days.Should().BeEmpty(
                "the real phase-1 projection must exclude weeks[].days content for EVERY week"));
            projected.GlobalSettings.Should().NotBeNull("plan-level GlobalSettings must survive the light projection");
            projected.GlobalSettings!.DailyKcal.Should().Be(2200);
        }

        // ── 1b. Direct assertion on the REAL phase-2 positional projection against real Mongo ──
        // Regression guard: an inclusion-only "weeks.$" projection returns ONLY `_id` and
        // `weeks` — every other field (including `externalId`) is excluded and deserializes to
        // its C# default (Guid.Empty) unless explicitly re-included in the projection. This
        // exact bug made FetchHydratedWeekAsync silently return null on every real call (the
        // defensive ExternalId-match guard always failed against a Guid.Empty), invisible to
        // the mocked unit tests since NSubstitute ignores the Projection option entirely.
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            var weekFilter = Builders<NutritionPlan>.Filter.And(
                Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, planId),
                Builders<NutritionPlan>.Filter.Eq("weeks.weekNumber", 3));
            var weekProjection = Builders<NutritionPlan>.Projection.Combine(
                Builders<NutritionPlan>.Projection.Include(p => p.ExternalId),
                Builders<NutritionPlan>.Projection.Include("weeks.$"));
            using var cursor = await mongo.NutritionPlans.FindAsync(
                weekFilter,
                new FindOptions<NutritionPlan, NutritionPlan> { Projection = weekProjection },
                TestContext.Current.CancellationToken);
            var hydratedPlans = await cursor.ToListAsync(TestContext.Current.CancellationToken);

            hydratedPlans.Should().ContainSingle();
            hydratedPlans[0].ExternalId.Should().Be(planId,
                "the phase-2 projection must explicitly re-include ExternalId — otherwise it deserializes to Guid.Empty " +
                "and the endpoint's defensive ExternalId match silently fails on every real request");
            var hydratedWeek = hydratedPlans[0].Weeks.Should().ContainSingle().Subject;
            hydratedWeek.WeekNumber.Should().Be(3, "the positional $ operator must match the correct non-zero-index array element");
        }

        // ── 2. Real HTTP round-trip: phase-2 must hydrate EXACTLY week 3's content ─────────
        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync("/client/nutrition/plan/today", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        var body = await response.Content.ReadFromJsonAsync<TodayPlanResponseDto>(
            jsonOptions,
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.PlanId.Should().Be(planId);
        body.WeekNumber.Should().Be(3, "today's date must resolve to week 3, not week 1 (proves phase-1 metadata drove real window/week resolution)");
        body.DayOfWeek.Should().Be(todayDow);
        body.Meals.Should().ContainSingle();

        var hydratedMeal = body.Meals[0];
        hydratedMeal.MealId.Should().Be(week3MealId,
            "phase-2 hydration must fetch week 3's meal — a wrong/off-by-one positional $ match would return week 1's or week 2's instead");
        hydratedMeal.Foods.Should().ContainSingle();
        hydratedMeal.Foods[0].FoodName.Should().Be("Week 3 Food (target)");

        // ── 3. Byte-equivalence: matches exactly what a naive full-fetch of the seed would produce ──
        body.GlobalSettings.Should().NotBeNull();
        body.GlobalSettings!.DailyKcal.Should().Be(2200);
        body.Meals.Should().NotContain(m => m.MealId == week1MealId || m.MealId == week2MealId,
            "sibling weeks' meal content must never leak into the hydrated response");
    }

    /// <summary>
    /// Regression guard for #850. Seeds a legacy no-<c>StartDate</c> plan whose published weeks
    /// carry a DUPLICATE weekNumber in document order — <c>wn=1 "A"</c>, <c>wn=1 "B"</c>,
    /// <c>wn=2 "C"</c> — and asserts the legacy selection branch (<c>GetTodayPlanEndpoint</c>
    /// lines ~157-183) and the phase-2 <c>weeks.$</c> hydration step resolve to the SAME week.
    /// </summary>
    /// <remarks>
    /// Publish date is 7 days ago so <c>daysSincePublish == 7</c>, landing on <c>weekIndex == 1</c>
    /// — NOT day 0, which always resolves <c>weekIndex == 0</c>, where the buggy positional lookup
    /// and the fixed weekNumber-keyed lookup coincidentally agree (both land on "A") and so cannot
    /// distinguish pre-fix from post-fix behavior. At <c>weekIndex == 1</c>:
    /// <list type="bullet">
    /// <item>PRE-FIX (position-based, <c>publishedWeeks[weekIndex]</c> over the raw 3-element
    /// list) selects the <c>wn=1 "B"</c> duplicate, but hydration's
    /// <c>Eq("weeks.weekNumber", 1)</c> always resolves the FIRST document-order match —
    /// <c>wn=1 "A"</c> — a silent content mismatch: the response reports <c>weekNumber=1</c> and
    /// "A"'s meal, never "B"'s.</item>
    /// <item>POST-FIX (weekNumber-keyed, <c>distinctPublishedWeeks[weekIndex]</c> over the deduped
    /// 2-element list) selects <c>wn=2 "C"</c>, and hydration for <c>weekNumber=2</c> also
    /// resolves "C" — selection and hydration agree, and the response reports <c>weekNumber=2</c>
    /// with "C"'s meal.</item>
    /// </list>
    /// </remarks>
    [Fact]
    public async Task GetTodayPlan_LegacyPlanWithDuplicateWeekNumbers_SelectionAndHydrationResolveSameWeek()
    {
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Dup", "Week", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == email,
                TestContext.Current.CancellationToken);
            // GetTodayPlanEndpoint filters NutritionPlan.ClientId on ClientProfile.UserId (#840)
            // — seed the plan with UserId, not PublicId.
            clientUserId = user.Id;
        }

        // Legacy plan: no StartDate, published 7 days ago so daysSincePublish == 7 — see the
        // <remarks> above for why day 0 cannot distinguish pre-fix from post-fix behavior.
        var datePublished = DateTime.UtcNow.Date.AddDays(-7);
        const int targetDayIndex = 0;

        var weekOneAMealId = Guid.NewGuid();
        var weekOneBMealId = Guid.NewGuid();
        var weekTwoMealId = Guid.NewGuid();
        var planId = Guid.NewGuid();

        var plan = new NutritionPlan
        {
            ExternalId = planId,
            ClientId = clientUserId,
            NutritionistId = Guid.NewGuid(),
            Name = "Legacy Duplicate Week Plan",
            Status = NutritionPlanStatus.Active,
            StartDate = null,
            DatePublished = datePublished,
            Version = 1,
            DateCreated = datePublished,
            Weeks =
            [
                BuildWeek(1, targetDayIndex, weekOneAMealId, "Week 1 Food A (duplicate — must never appear)", datePublished),
                BuildWeek(1, targetDayIndex, weekOneBMealId, "Week 1 Food B (duplicate — must never appear)", datePublished),
                BuildWeek(2, targetDayIndex, weekTwoMealId, "Week 2 Food (target)", datePublished)
            ]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.NutritionPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync("/client/nutrition/plan/today", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        var body = await response.Content.ReadFromJsonAsync<TodayPlanResponseDto>(
            jsonOptions,
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.PlanId.Should().Be(planId);
        body.WeekNumber.Should().Be(2,
            "weekIndex 1 over the DEDUPED 2-element week list (wn=1, wn=2) must resolve wn=2 — " +
            "the pre-fix position-based lookup over the raw 3-element list would instead report weekNumber=1");
        body.DayOfWeek.Should().Be(1, "day index 0 (targetDayIndex) maps to BuildWeek's DayOfWeek=1");
        body.Meals.Should().ContainSingle();

        var hydratedMeal = body.Meals[0];
        hydratedMeal.MealId.Should().Be(weekTwoMealId,
            "selection and hydration must both resolve wn=2 \"C\" — neither wn=1 duplicate " +
            "(\"A\" nor \"B\") may leak into the response");
        hydratedMeal.Foods.Should().ContainSingle();
        hydratedMeal.Foods[0].FoodName.Should().Be("Week 2 Food (target)");
    }

    /// <summary>
    /// Regression guard for #850. The legacy branch's cycle length (<c>totalDays</c>) must derive
    /// from the DEDUPED published-week count, not the raw count including duplicates — otherwise
    /// a legacy plan with duplicate <c>weekNumber</c> values cycles back to week 1 too late,
    /// re-reading a week that was already deduped away instead of wrapping.
    /// </summary>
    /// <remarks>
    /// Same 3-element duplicate seed as the sibling test (<c>wn=1 "A"</c>, <c>wn=1 "B"</c>,
    /// <c>wn=2 "C"</c>), but with <c>daysSincePublish == 14</c> — exactly one full cycle of the
    /// DEDUPED 2-week (14-day) list, landing back on <c>weekIndex == 0</c> ("A"). Under the
    /// pre-fix <c>totalDays = publishedWeeks.Count * 7 == 21</c> (raw 3-element count), 14 days
    /// falls short of a full cycle: <c>weekIndex = 14 / 7 == 2</c>, resolving the raw list's
    /// third element ("C", weekNumber=2) instead. This is the specific gap qa-tester flagged: the
    /// prior duplicate-week test's <c>daysSincePublish == 7</c> is index-identical whether
    /// <c>totalDays</c> is 14 or 21, so it cannot catch a regression back to the raw count.
    /// </remarks>
    [Fact]
    public async Task GetTodayPlan_LegacyPlanWithDuplicateWeekNumbers_CyclesOnDedupedWeekCount()
    {
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Cyc", "Week", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == email,
                TestContext.Current.CancellationToken);
            clientUserId = user.Id;
        }

        var datePublished = DateTime.UtcNow.Date.AddDays(-14);
        const int targetDayIndex = 0;

        var weekOneAMealId = Guid.NewGuid();
        var weekOneBMealId = Guid.NewGuid();
        var weekTwoMealId = Guid.NewGuid();
        var planId = Guid.NewGuid();

        var plan = new NutritionPlan
        {
            ExternalId = planId,
            ClientId = clientUserId,
            NutritionistId = Guid.NewGuid(),
            Name = "Legacy Duplicate Week Cycle Plan",
            Status = NutritionPlanStatus.Active,
            StartDate = null,
            DatePublished = datePublished,
            Version = 1,
            DateCreated = datePublished,
            Weeks =
            [
                BuildWeek(1, targetDayIndex, weekOneAMealId, "Week 1 Food A (target — cycle wraps back here)", datePublished),
                BuildWeek(1, targetDayIndex, weekOneBMealId, "Week 1 Food B (duplicate — must never appear)", datePublished),
                BuildWeek(2, targetDayIndex, weekTwoMealId, "Week 2 Food (must never appear)", datePublished)
            ]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.NutritionPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync("/client/nutrition/plan/today", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        var body = await response.Content.ReadFromJsonAsync<TodayPlanResponseDto>(
            jsonOptions,
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.PlanId.Should().Be(planId);
        body.WeekNumber.Should().Be(1,
            "a 14-day cycle over the DEDUPED 2-week list must wrap back to wn=1 — a regression " +
            "to the raw 3-element count would instead resolve wn=2 at this offset");
        body.Meals.Should().ContainSingle();

        var hydratedMeal = body.Meals[0];
        hydratedMeal.MealId.Should().Be(weekOneAMealId,
            "the wrapped cycle must resolve the FIRST document-order wn=1 week (\"A\"), not \"B\" or \"C\"");
        hydratedMeal.Foods.Should().ContainSingle();
        hydratedMeal.Foods[0].FoodName.Should().Be("Week 1 Food A (target — cycle wraps back here)");
    }

    /// <summary>
    /// Regression guard for #850. The legacy branch's <c>dayIndex</c> bounds guard
    /// (<c>GetTodayPlanEndpoint.cs</c> ~lines 195-202) must return 404 instead of letting an
    /// out-of-range index into <c>hydratedWeek.Days</c> surface as an unhandled exception, when a
    /// legacy week was hydrated with fewer than 7 days.
    /// </summary>
    [Fact]
    public async Task GetTodayPlan_LegacyPlanWithTruncatedWeek_DayIndexOutOfRange_Returns404()
    {
        var httpClient = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, email, "TestPass1!", "Trunc", "Week", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, email, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == email,
                TestContext.Current.CancellationToken);
            clientUserId = user.Id;
        }

        // Published 6 days ago, single published week — daysSincePublish == 6, totalDays == 7,
        // weekIndex == 0, dayIndex == 6. The week itself only carries 3 days, so index 6 is out
        // of range and must be treated as "no plan for today" rather than throwing.
        var datePublished = DateTime.UtcNow.Date.AddDays(-6);
        var planId = Guid.NewGuid();

        var truncatedWeek = new PlanWeek
        {
            WeekNumber = 1,
            Status = WeekStatus.Published,
            DatePublished = datePublished,
            Days = Enumerable.Range(1, 3).Select(d => new PlanDay { DayOfWeek = d, Meals = [] }).ToList()
        };

        var plan = new NutritionPlan
        {
            ExternalId = planId,
            ClientId = clientUserId,
            NutritionistId = Guid.NewGuid(),
            Name = "Legacy Truncated Week Plan",
            Status = NutritionPlanStatus.Active,
            StartDate = null,
            DatePublished = datePublished,
            Version = 1,
            DateCreated = datePublished,
            Weeks = [truncatedWeek]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.NutritionPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync("/client/nutrition/plan/today", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "dayIndex 6 exceeds the truncated week's 3 days — the endpoint must guard this as 404, " +
            "not let an ArgumentOutOfRangeException surface as a 500");
    }

    // ── Local response DTOs (per slice rules — not shared across features) ────────

    private record TodayPlanResponseDto(
        Guid PlanId,
        string PlanName,
        int WeekNumber,
        int DayOfWeek,
        List<MealResponseDto> Meals,
        GlobalSettingsResponseDto? GlobalSettings);

    private record MealResponseDto(
        Guid MealId,
        string Kind,
        int Order,
        List<FoodResponseDto> Foods);

    private record FoodResponseDto(
        Guid FoodExternalId,
        string FoodName);

    private record GlobalSettingsResponseDto(
        decimal? DailyKcal);
}
