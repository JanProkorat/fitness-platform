using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Endpoints.TrainingPlans;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Client.Plans;

/// <summary>
/// Integration tests for <c>GET /client/plans</c> that verify the real MongoDB
/// ElemMatch filter excludes plans with no published weeks.
/// NSubstitute mocks cannot prove this — they ignore the FilterDefinition.
/// These tests seed Mongo directly via Testcontainers and hit the real HTTP stack.
/// </summary>
[Collection(TestCollection.Name)]
public class GetClientPlansIntegrationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@integration-test.com";

    /// <summary>
    /// Proves that the ElemMatch filter introduced in the bug-fix actually works
    /// against a real MongoDB instance:
    /// - Plan A (Active, one Draft week only) must be excluded.
    /// - Plan B (Active, one Published week) must be included.
    ///
    /// Before the fix both plans were returned; after the fix only Plan B appears.
    /// </summary>
    [Fact]
    public async Task ActivePlanWithOnlyDraftWeeks_IsExcluded_ActivePlanWithPublishedWeek_IsIncluded()
    {
        var httpClient = factory.CreateClient();

        // ── 1. Register + log in a real client so Postgres has a ClientProfile ──
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, clientEmail, "TestPass1!", "Test", "Client", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, clientEmail, "TestPass1!");

        // ── 2. Resolve the client's ApplicationUser.Id from Postgres (= ClientId in Mongo,
        //      #840/#845 — GetClientPlansEndpoint resolves clientProfile.UserId, NOT
        //      ClientProfile.PublicId, and filters Mongo documents on that value) ──
        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == clientEmail,
                TestContext.Current.CancellationToken);
            var profile = await db.ClientProfiles.FirstAsync(
                cp => cp.UserId == user.Id,
                TestContext.Current.CancellationToken);
            clientUserId = profile.UserId;
        }

        // ── 3. Seed two TrainingPlan documents directly into the real Mongo ──
        var planAId = Guid.NewGuid(); // Active, Draft week only — must be EXCLUDED
        var planBId = Guid.NewGuid(); // Active, Published week    — must be INCLUDED

        var planA = new TrainingPlan
        {
            ExternalId = planAId,
            ClientId = clientUserId,
            TrainerId = Guid.NewGuid(),
            Name = "Draft-Only Plan",
            Status = TrainingPlanStatus.Active,
            Version = 1,
            DateCreated = DateTime.UtcNow,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Draft, // <── no published week
                    Days = []
                }
            ]
        };

        var planB = new TrainingPlan
        {
            ExternalId = planBId,
            ClientId = clientUserId,
            TrainerId = Guid.NewGuid(),
            Name = "Published-Week Plan",
            Status = TrainingPlanStatus.Active,
            Version = 1,
            DateCreated = DateTime.UtcNow,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = DateTime.UtcNow.AddDays(-1),
                    Days = []
                }
            ]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(planA, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.TrainingPlans.InsertOneAsync(planB, cancellationToken: TestContext.Current.CancellationToken);
        }

        // ── 4. GET /client/plans?status=Active with the client's bearer token ──
        TestHelpers.SetBearerToken(httpClient, accessToken);
        var response = await httpClient.GetAsync(
            "/client/plans?status=Active",
            TestContext.Current.CancellationToken);

        // ── 5. Assert ──
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<PlansResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        var items = body!.Items;

        // Only Plan B should appear
        items.Should().ContainSingle(i => i.PlanId == planBId,
            "plan B has a published week and must pass the ElemMatch filter");

        // Plan A must be absent
        items.Should().NotContain(i => i.PlanId == planAId,
            "plan A has only a draft week and must be excluded by the ElemMatch filter");
    }

    /// <summary>
    /// Reproduces the #873 cross-endpoint disagreement against a real MongoDB instance: a client
    /// holds two Active training plans of the same type — one ranged (<c>StartDate</c> covers
    /// today) and one unranged (legacy data, no <c>StartDate</c>), both with a session scheduled
    /// on today's day-of-week. <c>GetTodaySessionEndpoint</c> resolves the ranged plan as
    /// "current" via <c>PlanWindowResolver.ResolveCurrentPlan</c>; <c>GetClientPlansEndpoint</c>
    /// must agree — before the fix, it independently evaluated each plan's own legacy week-cycle
    /// formula and reported the unranged sibling as also having a live session today.
    /// </summary>
    [Fact]
    public async Task ActiveTrainingPlans_UnrangedSiblingOfSelectedRangedPlan_AgreesWithGetTodaySession()
    {
        var httpClient = factory.CreateClient();

        // ── 1. Register + log in a real client ──
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(httpClient, clientEmail, "TestPass1!", "Test", "Client", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(httpClient, clientEmail, "TestPass1!");

        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(
                u => u.Email == clientEmail,
                TestContext.Current.CancellationToken);
            var profile = await db.ClientProfiles.FirstAsync(
                cp => cp.UserId == user.Id,
                TestContext.Current.CancellationToken);
            clientUserId = profile.UserId;
        }

        var todayDow = (int)DateTime.UtcNow.DayOfWeek;
        todayDow = todayDow == 0 ? 7 : todayDow;

        // ── 2. Seed two Active TrainingPlan documents — one ranged, one unranged ──
        var rangedPlanId = Guid.NewGuid();
        var rangedPlan = TrainingPlanTestHelpers.CreatePlan(
            externalId: rangedPlanId,
            clientId: clientUserId,
            status: TrainingPlanStatus.Active,
            weekCount: 1);
        rangedPlan.StartDate = DateTime.UtcNow.Date;
        rangedPlan.Weeks[0].Status = WeekStatus.Published;
        rangedPlan.Weeks[0].DatePublished = DateTime.UtcNow.AddDays(-1);
        rangedPlan.Weeks[0].Days.First(d => d.DayOfWeek == todayDow).Sessions.Add(new TrainingSession
        {
            SessionId = Guid.NewGuid(),
            Name = "Ranged Plan Session",
            Order = 1
        });

        var unrangedPlanId = Guid.NewGuid();
        var unrangedPlan = TrainingPlanTestHelpers.CreatePlan(
            externalId: unrangedPlanId,
            clientId: clientUserId,
            status: TrainingPlanStatus.Active,
            weekCount: 1);
        // StartDate deliberately left null — legacy unranged plan.
        unrangedPlan.Weeks[0].Status = WeekStatus.Published;
        unrangedPlan.Weeks[0].DatePublished = DateTime.UtcNow.AddDays(-1);
        unrangedPlan.Weeks[0].Days.First(d => d.DayOfWeek == todayDow).Sessions.Add(new TrainingSession
        {
            SessionId = Guid.NewGuid(),
            Name = "Unranged Plan Session",
            Order = 1
        });

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(rangedPlan, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.TrainingPlans.InsertOneAsync(unrangedPlan, cancellationToken: TestContext.Current.CancellationToken);
        }

        TestHelpers.SetBearerToken(httpClient, accessToken);

        // ── 3. GET /client/plans?status=Active ──
        var plansResponse = await httpClient.GetAsync(
            "/client/plans?status=Active",
            TestContext.Current.CancellationToken);
        plansResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var plansBody = await plansResponse.Content.ReadFromJsonAsync<PlansWithSessionResponse>(
            cancellationToken: TestContext.Current.CancellationToken);
        plansBody.Should().NotBeNull();

        var rangedItem = plansBody!.Items.Single(i => i.PlanId == rangedPlanId);
        var unrangedItem = plansBody.Items.Single(i => i.PlanId == unrangedPlanId);

        // ── 4. GET /client/training/plan/today ──
        var todayResponse = await httpClient.GetAsync(
            "/client/training/plan/today",
            TestContext.Current.CancellationToken);
        todayResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var todayBody = await todayResponse.Content.ReadFromJsonAsync<TodaySessionResponse>(
            cancellationToken: TestContext.Current.CancellationToken);
        todayBody.Should().NotBeNull();

        // ── 5. The two endpoints must agree ──
        todayBody!.PlanId.Should().Be(rangedPlanId,
            "PlanWindowResolver.ResolveCurrentPlan must select the ranged plan over its unranged sibling");
        todayBody.HasSession.Should().BeTrue();

        rangedItem.HasTodaySession.Should().BeTrue();
        unrangedItem.HasTodaySession.Should().BeFalse(
            "the unranged sibling was not selected as the current plan and must not independently claim a live session");
    }

    // ── Progress fields (#1604) ──

    /// <summary>Monday three weeks before the current week — keeps "today" inside week 4 of a 4-week plan.</summary>
    private static DateTime PlanStartMonday() => TrainingPlanTestHelpers.LastMonday().AddDays(-21);

    private async Task<Actor> CreateClientAsync() =>
        await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

    private async Task<PlanProgressItem> GetSinglePlanAsync(Actor client, Guid planId)
    {
        var response = await client.Http.GetAsync("/client/plans", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<PlanProgressResponse>(
            cancellationToken: TestContext.Current.CancellationToken);
        return body!.Items.Single(i => i.PlanId == planId);
    }

    [Fact]
    public async Task TrainingPlan_PartialCompletion_ReportsSessionsDoneAndTotalWithinWindow()
    {
        var client = await CreateClientAsync();
        var trainer = await TestActors.Trainer(factory)
            .WithName("Martin", "Novak")
            .CreateAsync(TestContext.Current.CancellationToken);

        var start = PlanStartMonday();
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, clientId: client.UserId, trainerId: trainer.UserId,
            status: TrainingPlanStatus.Active, weekCount: 4);
        plan.StartDate = start;

        // One session on Monday of each of the four weeks.
        var sessionIds = new List<Guid>();
        foreach (var week in plan.Weeks)
        {
            week.Status = WeekStatus.Published;
            week.DatePublished = start.AddDays(-1);
            var sessionId = Guid.NewGuid();
            sessionIds.Add(sessionId);
            week.Days.First(d => d.DayOfWeek == 1).Sessions.Add(new TrainingSession
            {
                SessionId = sessionId,
                Name = $"Session {week.WeekNumber}",
                Order = 1,
                StandaloneExercises =
                [
                    new SessionExercise
                    {
                        ExerciseId = Guid.NewGuid(),
                        ExerciseExternalId = Guid.NewGuid(),
                        ExerciseName = "Plank",
                        Order = 1
                    }
                ]
            });
        }

        SessionExecution Execution(int weekIndex, DateTime date, SessionExecutionStatus status) => new()
        {
            ExternalId = Guid.NewGuid(),
            ClientId = client.UserId,
            PlanId = planId,
            SessionId = sessionIds[weekIndex],
            Date = date,
            Status = status,
            DateCreated = DateTime.UtcNow
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
            await mongo.SessionExecutions.InsertManyAsync(
            [
                Execution(0, start, SessionExecutionStatus.Completed),
                Execution(1, start.AddDays(7), SessionExecutionStatus.Completed),
                Execution(2, start.AddDays(14), SessionExecutionStatus.Partial),
                // Completed, but dated after today: outside the window and not a planned day.
                Execution(3, start.AddDays(60), SessionExecutionStatus.Completed)
            ], cancellationToken: TestContext.Current.CancellationToken);
        }

        var item = await GetSinglePlanAsync(client, planId);

        item.SessionsTotal.Should().Be(4);
        item.SessionsDone.Should().Be(2);
        item.MealsLoggedPercent.Should().BeNull("training plans carry no meals");
        item.EndDate.Should().Be(start.AddDays(4 * 7 - 1));
        item.ProfessionalName.Should().Be("Martin Novak");
        item.ProfessionalRole.Should().Be("Trainer");
    }

    [Fact]
    public async Task NutritionPlan_PartialMealLogs_ReportsPercentOfPlannedMealsLogged()
    {
        var client = await CreateClientAsync();
        var nutritionist = await TestActors.Nutritionist(factory)
            .WithName("Eva", "Svobodova")
            .CreateAsync(TestContext.Current.CancellationToken);

        var start = PlanStartMonday();
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId, clientId: client.UserId, nutritionistId: nutritionist.UserId,
            status: NutritionPlanStatus.Active, weekCount: 4);
        plan.StartDate = start;

        // Two meals on Monday of each week: 8 planned meals up to today.
        var mealIds = new[] { Guid.NewGuid(), Guid.NewGuid() };
        foreach (var week in plan.Weeks)
        {
            week.Status = WeekStatus.Published;
            week.DatePublished = start.AddDays(-1);
            week.Days.First(d => d.DayOfWeek == 1).Meals =
            [
                PlanTestHelpers.CreateMeal(mealIds[0], MealKind.Breakfast, 1),
                PlanTestHelpers.CreateMeal(mealIds[1], MealKind.Lunch, 2)
            ];
        }

        MealLog Log(Guid mealId, DateTime day, DateTime? eatenAt) => new()
        {
            ClientId = client.UserId,
            PlanId = planId,
            MealId = mealId,
            LogDate = day,
            EatenAt = eatenAt
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.NutritionPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
            var logs = new List<MealLog>();
            for (var weekIndex = 0; weekIndex < 3; weekIndex++)
            {
                var day = start.AddDays(7 * weekIndex);
                logs.Add(Log(mealIds[0], day, day.AddHours(8)));
                logs.Add(Log(mealIds[1], day, day.AddHours(13)));
            }

            // Not eaten (photo-only entry) and eaten after today: neither counts.
            logs.Add(Log(mealIds[0], start.AddDays(21), null));
            logs.Add(Log(mealIds[1], start.AddDays(70), start.AddDays(70).AddHours(13)));
            await mongo.MealLogs.InsertManyAsync(logs, cancellationToken: TestContext.Current.CancellationToken);
        }

        var item = await GetSinglePlanAsync(client, planId);

        item.MealsLoggedPercent.Should().Be(75);
        item.SessionsTotal.Should().BeNull("nutrition plans carry no sessions");
        item.SessionsDone.Should().BeNull();
        item.ProfessionalName.Should().Be("Eva Svobodova");
        item.ProfessionalRole.Should().Be("Nutritionist");
    }

    [Fact]
    public async Task Plan_WithoutStartDate_HasNullProgressFields()
    {
        var client = await CreateClientAsync();
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, clientId: client.UserId,
            status: TrainingPlanStatus.Active, weekCount: 1);
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = DateTime.UtcNow.AddDays(-1);

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        var item = await GetSinglePlanAsync(client, planId);

        item.EndDate.Should().BeNull();
        item.SessionsTotal.Should().BeNull();
        item.SessionsDone.Should().BeNull();
        item.MealsLoggedPercent.Should().BeNull();
    }

    [Fact]
    public async Task Plan_AuthorUserMissing_ProfessionalNameNullAndRoleStillSet()
    {
        var client = await CreateClientAsync();
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, clientId: client.UserId, trainerId: Guid.NewGuid(),
            status: TrainingPlanStatus.Active, weekCount: 1);
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = DateTime.UtcNow.AddDays(-1);

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        var item = await GetSinglePlanAsync(client, planId);

        item.ProfessionalName.Should().BeNull();
        item.ProfessionalRole.Should().Be("Trainer");
    }

    // ── Local response DTOs (not sharing across features per slice rules) ──

    private record PlanProgressItem(
        Guid PlanId,
        DateTime? EndDate,
        int? SessionsTotal,
        int? SessionsDone,
        int? MealsLoggedPercent,
        string? ProfessionalName,
        string? ProfessionalRole);
    private record PlanProgressResponse(List<PlanProgressItem> Items);

    private record PlanItem(Guid PlanId, string Type, string Status);
    private record PlansResponse(List<PlanItem> Items);

    private record PlanWithSessionItem(Guid PlanId, bool? HasTodaySession);
    private record PlansWithSessionResponse(List<PlanWithSessionItem> Items);
    private record TodaySessionResponse(Guid? PlanId, bool HasSession);
}
