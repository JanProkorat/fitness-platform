using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
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

    // ── Local response DTOs (not sharing across features per slice rules) ──

    private record PlanItem(Guid PlanId, string Type, string Status);
    private record PlansResponse(List<PlanItem> Items);

    private record PlanWithSessionItem(Guid PlanId, bool? HasTodaySession);
    private record PlansWithSessionResponse(List<PlanWithSessionItem> Items);
    private record TodaySessionResponse(Guid? PlanId, bool HasSession);
}
