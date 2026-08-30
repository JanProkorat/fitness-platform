using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.NutritionPlans.CompletePlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="CompletePlanEndpoint"/>.
/// </summary>
public class CompletePlanEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    private CompletePlanEndpoint CreateEndpoint(
        IMongoContext mongo, IClientLinkAuthorizationService? linkAuthorizationService = null) =>
        Factory.Create<CompletePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo,
            new MockDbBuilder().Build(),
            Substitute.For<INotificationService>(),
            Substitute.For<IRealtimeNotifier>(),
            new PlanConcurrencyGuard(),
            linkAuthorizationService ?? EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

    [Fact]
    public async Task HandleAsync_ActivePlan_CompletesSuccessfully()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId, nutritionistId: _nutritionistId, status: NutritionPlanStatus.Active);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(
            new CompletePlanRequest { PlanId = planId, Version = plan.Version },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.NutritionPlan>>(),
            Arg.Is<Application.Domain.Documents.NutritionPlan>(p => p.Status == NutritionPlanStatus.Completed),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_PlanNotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(
            new CompletePlanRequest { PlanId = Guid.NewGuid(), Version = 1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// Deny-path test for the link-authorization guard itself (not authorship or plan state).
    /// The plan is owned by the caller and Active, but the caller's link to the plan's client no
    /// longer grants nutrition access — this must still 404. If
    /// <see cref="IClientLinkAuthorizationService"/> were removed from this guard, this test
    /// would regress to 200.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NotLinkedToClient_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId, nutritionistId: _nutritionistId, status: NutritionPlanStatus.Active);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = CreateEndpoint(mongo, PlanTestHelpers.CreateDenyingLinkAuthorizationService());

        await ep.HandleAsync(
            new CompletePlanRequest { PlanId = planId, Version = plan.Version },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        await mongo.NutritionPlans.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.NutritionPlan>>(),
            Arg.Any<Application.Domain.Documents.NutritionPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Flag-inversion deny test: the link is active and exists, but grants only the training
    /// domain. A "no link" deny test cannot detect a guard that checks the wrong flag, since
    /// both flags are absent either way — this pins the guard to
    /// <c>CanViewNutritionPlans</c> specifically.
    /// </summary>
    [Fact]
    public async Task HandleAsync_LinkGrantsOnlyTraining_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId, nutritionistId: _nutritionistId, status: NutritionPlanStatus.Active);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = CreateEndpoint(
            mongo,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
                canViewNutritionPlans: false, canViewTrainingPlans: true));

        await ep.HandleAsync(
            new CompletePlanRequest { PlanId = planId, Version = plan.Version },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        await mongo.NutritionPlans.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.NutritionPlan>>(),
            Arg.Any<Application.Domain.Documents.NutritionPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }
}
