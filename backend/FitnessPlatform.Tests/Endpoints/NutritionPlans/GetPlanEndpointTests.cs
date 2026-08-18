using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="GetPlanEndpoint"/>.
/// </summary>
public class GetPlanEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    /// <summary>
    /// Builds a mocked <see cref="IApplicationDbContext"/> seeded with a <see cref="ClientProfile"/>
    /// whose <see cref="ClientProfile.UserId"/> matches the plan's internal storage-key <c>ClientId</c>
    /// (#840) and whose <see cref="ClientProfile.PublicId"/> is a DISTINCT guid — so assertions that
    /// compare against <paramref name="clientPublicId"/> actually prove the UserId→PublicId
    /// translation happened, rather than trivially passing because both values were equal.
    /// </summary>
    private static IApplicationDbContext CreateDbWithClientProfile(Guid clientUserId, out Guid clientPublicId)
    {
        clientPublicId = Guid.NewGuid();
        return new MockDbBuilder()
            .With(new ClientProfile { UserId = clientUserId, PublicId = clientPublicId })
            .Build();
    }

    [Fact]
    public async Task HandleAsync_PlanExists_ReturnsDetail()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            name: "My Plan");
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateDbWithClientProfile(plan.ClientId, out var clientPublicId);

        var ep = Factory.Create<GetPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, db,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new GetPlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.Name.Should().Be("My Plan");

        // Outward ClientId must be the ClientProfile.PublicId (#840 restoration), NOT the internal
        // ApplicationUser.Id storage key — distinct GUIDs prove the translation actually happened.
        ep.Response.ClientId.Should().Be(clientPublicId);
        ep.Response.ClientId.Should().NotBe(plan.ClientId);
    }

    [Fact]
    public async Task HandleAsync_PlanNotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, db,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(
            new GetPlanRequest { PlanId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── MealLog fold-in tests (issue #329) ──────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoMealLogs_ReturnsPlanWithEmptyMealLogsList()
    {
        // Arrange — plan with no meal logs; MealLogs should come back as an empty list
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan], mealLogs: []);
        var db = CreateDbWithClientProfile(plan.ClientId, out _);

        var ep = Factory.Create<GetPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, db,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        // Act
        await ep.HandleAsync(new GetPlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.MealLogs.Should().NotBeNull();
        ep.Response.MealLogs.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_MealLogWithNullEatenAt_IsNotEaten()
    {
        // Arrange — log with EatenAt null is a photo-only/note-only stub → IsEaten = false
        var planId = Guid.NewGuid();
        var mealId = Guid.NewGuid();
        var logDate = new DateTime(2025, 3, 10, 0, 0, 0, DateTimeKind.Utc);

        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var log = PlanTestHelpers.CreateMealLog(
            planId: planId,
            mealId: mealId,
            logDate: logDate,
            eatenAt: null);  // photo-only stub

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan], mealLogs: [log]);
        var db = CreateDbWithClientProfile(plan.ClientId, out _);

        var ep = Factory.Create<GetPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, db,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        // Act
        await ep.HandleAsync(new GetPlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.MealLogs.Should().HaveCount(1);
        ep.Response.MealLogs[0].MealId.Should().Be(mealId);
        ep.Response.MealLogs[0].IsEaten.Should().BeFalse("EatenAt is null → photo-only stub, not eaten");
        ep.Response.MealLogs[0].EatenAt.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_MealLogWithEatenAt_IsEaten()
    {
        // Arrange — log with EatenAt set → IsEaten = true
        var planId = Guid.NewGuid();
        var mealId = Guid.NewGuid();
        var logDate = new DateTime(2025, 3, 10, 0, 0, 0, DateTimeKind.Utc);
        var eatenAt = new DateTime(2025, 3, 10, 8, 30, 0, DateTimeKind.Utc);

        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var log = PlanTestHelpers.CreateMealLog(
            planId: planId,
            mealId: mealId,
            logDate: logDate,
            eatenAt: eatenAt);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan], mealLogs: [log]);
        var db = CreateDbWithClientProfile(plan.ClientId, out _);

        var ep = Factory.Create<GetPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, db,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        // Act
        await ep.HandleAsync(new GetPlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.MealLogs.Should().HaveCount(1);
        ep.Response.MealLogs[0].MealId.Should().Be(mealId);
        ep.Response.MealLogs[0].IsEaten.Should().BeTrue("EatenAt is non-null → meal was confirmed eaten");
        ep.Response.MealLogs[0].EatenAt.Should().Be(eatenAt);
    }

    [Fact]
    public async Task HandleAsync_PlanBelongsToDifferentNutritionist_Returns404_AndMealLogsNotQueried()
    {
        // Arrange — plan belongs to a DIFFERENT nutritionist → ownership gate fires, 404 returned,
        // MealLog collection should not be touched (no IDOR leakage).
        var planId = Guid.NewGuid();
        var otherNutritionistId = Guid.NewGuid();

        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: otherNutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = new MockDbBuilder().Build();

        var callerNutritionistId = Guid.NewGuid();  // not the owner
        var ep = Factory.Create<GetPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(callerNutritionistId, AppRoles.Nutritionist))),
            mongo, db,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        // Act
        await ep.HandleAsync(new GetPlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        // Assert — 404 (no existence leak)
        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// Deny-path test for the link-authorization guard itself (not authorship). The plan is
    /// owned by the caller, but the caller's link to the plan's client no longer grants nutrition
    /// access — this must still 404, distinct from
    /// <see cref="HandleAsync_PlanBelongsToDifferentNutritionist_Returns404_AndMealLogsNotQueried"/>
    /// which denies on authorship.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NotLinkedToClient_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateDbWithClientProfile(plan.ClientId, out _);

        var ep = Factory.Create<GetPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, db,
            PlanTestHelpers.CreateDenyingLinkAuthorizationService());

        await ep.HandleAsync(new GetPlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_AllMealsInDayEaten_ReturnsMealLogListWithAllIsEatenTrue()
    {
        // Arrange — all three meals for a given day have EatenAt set.
        // Backend returns the flat list; the web layer derives day-level all-eaten state
        // from the per-meal entries — no separate aggregate field on the response.
        var planId = Guid.NewGuid();
        var logDate = new DateTime(2025, 3, 10, 0, 0, 0, DateTimeKind.Utc);
        var eatenAt = new DateTime(2025, 3, 10, 12, 0, 0, DateTimeKind.Utc);

        var mealId1 = Guid.NewGuid();
        var mealId2 = Guid.NewGuid();
        var mealId3 = Guid.NewGuid();

        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var logs = new[]
        {
            PlanTestHelpers.CreateMealLog(planId, mealId1, logDate, eatenAt),
            PlanTestHelpers.CreateMealLog(planId, mealId2, logDate, eatenAt),
            PlanTestHelpers.CreateMealLog(planId, mealId3, logDate, eatenAt)
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan], mealLogs: logs);
        var db = CreateDbWithClientProfile(plan.ClientId, out _);

        var ep = Factory.Create<GetPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, db,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        // Act
        await ep.HandleAsync(new GetPlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        // Assert — backend returns 3 log entries, all IsEaten = true
        // Web derives day-level state (all-eaten) from this flat list
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.MealLogs.Should().HaveCount(3);
        ep.Response.MealLogs.Should().AllSatisfy(l =>
        {
            l.IsEaten.Should().BeTrue("all meals for this day were confirmed eaten");
            l.EatenAt.Should().Be(eatenAt);
        });
        ep.Response.MealLogs.Select(l => l.MealId).Should().BeEquivalentTo(new[] { mealId1, mealId2, mealId3 });
    }
}
