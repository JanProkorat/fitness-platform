using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.DeletePlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="DeletePlanEndpoint"/>. The mock Mongo ignores filters, so the hard-delete
/// and started-week rules are proven in <see cref="DeletePlanIntegrationTests"/>.
/// </summary>
public class DeletePlanEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    private DeletePlanEndpoint CreateEndpoint(IMongoContext mongo, IClientLinkAuthorizationService linkAuthorizationService) =>
        Factory.Create<DeletePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo,
            new MockDbBuilder().Build(),
            TimeProvider.System,
            linkAuthorizationService);

    [Fact]
    public async Task HandleAsync_OwnerDeletes_DeletesDocument()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        mongo.NutritionPlans
            .DeleteOneAsync(Arg.Any<FilterDefinition<NutritionPlan>>(), Arg.Any<CancellationToken>())
            .Returns(new DeleteResult.Acknowledged(1));

        var ep = CreateEndpoint(mongo, EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new DeletePlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await mongo.NutritionPlans.Received(1).DeleteOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<CancellationToken>());
        await mongo.NutritionPlans.DidNotReceiveWithAnyArgs().UpdateOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<UpdateDefinition<NutritionPlan>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// The delete filter pins the loaded Version; a zero delete count means the plan changed
    /// between load and delete and must surface as a version conflict, not a silent 204.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NothingDeleted_Returns409()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        mongo.NutritionPlans
            .DeleteOneAsync(Arg.Any<FilterDefinition<NutritionPlan>>(), Arg.Any<CancellationToken>())
            .Returns(new DeleteResult.Acknowledged(0));

        var ep = CreateEndpoint(mongo, EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new DeletePlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = CreateEndpoint(mongo, EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(
            new DeletePlanRequest { PlanId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// Deny-path test for the link-authorization guard itself (not authorship). The plan is
    /// owned by the caller, but the caller's link to the plan's client no longer grants nutrition
    /// access — this must still 404, distinct from <see cref="HandleAsync_NotFound_Returns404"/>
    /// which denies on a missing plan.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NotLinkedToClient_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = CreateEndpoint(mongo, PlanTestHelpers.CreateDenyingLinkAuthorizationService());

        await ep.HandleAsync(new DeletePlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
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
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = CreateEndpoint(
            mongo,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
                canViewNutritionPlans: false, canViewTrainingPlans: true));

        await ep.HandleAsync(new DeletePlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
