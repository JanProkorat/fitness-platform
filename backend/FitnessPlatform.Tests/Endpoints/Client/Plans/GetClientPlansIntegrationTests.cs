using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
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
                    Sessions = []
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
                    Sessions = []
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

    // ── Local response DTOs (not sharing across features per slice rules) ──

    private record PlanItem(Guid PlanId, string Type, string Status);
    private record PlansResponse(List<PlanItem> Items);
}
