using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.TrainingPlans.CompleteTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="CompleteTrainingPlanEndpoint"/>.
/// </summary>
public class CompleteTrainingPlanEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    private CompleteTrainingPlanEndpoint CreateEndpoint(
        IMongoContext mongo, IClientLinkAuthorizationService? linkAuthorizationService = null) =>
        Factory.Create<CompleteTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
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
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, status: TrainingPlanStatus.Active);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(
            new CompleteTrainingPlanRequest { PlanId = planId, Version = plan.Version },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.TrainingPlan>>(),
            Arg.Is<Application.Domain.Documents.TrainingPlan>(p => p.Status == TrainingPlanStatus.Completed),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_PlanNotFound_Returns404()
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongo();

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(
            new CompleteTrainingPlanRequest { PlanId = Guid.NewGuid(), Version = 1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// Deny-path test for the link-authorization guard itself (not authorship or plan state).
    /// The plan is owned by the caller and Active, but the caller's link to the plan's client no
    /// longer grants training access — this must still 404. If
    /// <see cref="IClientLinkAuthorizationService"/> were removed from this guard, this test
    /// would regress to 200.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NotLinkedToClient_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, status: TrainingPlanStatus.Active);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = CreateEndpoint(mongo, TrainingPlanTestHelpers.CreateDenyingLinkAuthorizationService());

        await ep.HandleAsync(
            new CompleteTrainingPlanRequest { PlanId = planId, Version = plan.Version },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        await mongo.TrainingPlans.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.TrainingPlan>>(),
            Arg.Any<Application.Domain.Documents.TrainingPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Flag-inversion deny test: the link is active and exists, but grants only the nutrition
    /// domain. A "no link" deny test cannot detect a guard that checks the wrong flag, since
    /// both flags are absent either way — this pins the guard to
    /// <c>CanViewTrainingPlans</c> specifically.
    /// </summary>
    [Fact]
    public async Task HandleAsync_LinkGrantsOnlyNutrition_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, status: TrainingPlanStatus.Active);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = CreateEndpoint(
            mongo,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
                canViewNutritionPlans: true, canViewTrainingPlans: false));

        await ep.HandleAsync(
            new CompleteTrainingPlanRequest { PlanId = planId, Version = plan.Version },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        await mongo.TrainingPlans.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.TrainingPlan>>(),
            Arg.Any<Application.Domain.Documents.TrainingPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }
}
