using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.TrainingPlans.LinkQuestionnaire;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="LinkTrainingQuestionnaireEndpoint"/>.
/// </summary>
public class LinkQuestionnaireEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    private LinkTrainingQuestionnaireEndpoint CreateEndpoint(
        IMongoContext mongo, IClientLinkAuthorizationService? linkAuthorizationService = null) =>
        Factory.Create<LinkTrainingQuestionnaireEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo,
            new MockDbBuilder().Build(),
            new PlanConcurrencyGuard(),
            linkAuthorizationService ?? EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

    [Fact]
    public async Task HandleAsync_Unlink_Returns200()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        plan.QuestionnaireResponseId = Guid.NewGuid();
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(
            new LinkTrainingQuestionnaireRequest { PlanId = planId, QuestionnaireResponseId = null, Version = plan.Version },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.TrainingPlan>>(),
            Arg.Is<Application.Domain.Documents.TrainingPlan>(p => p.QuestionnaireResponseId == null),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_PlanNotFound_Returns404()
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongo();

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(
            new LinkTrainingQuestionnaireRequest { PlanId = Guid.NewGuid(), Version = 1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// Deny-path test for the link-authorization guard itself (not authorship). The plan is
    /// owned by the caller, but the caller's link to the plan's client no longer grants training
    /// access — this must still 404. If <see cref="IClientLinkAuthorizationService"/> were
    /// removed from this guard, this test would regress to 200.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NotLinkedToClient_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = CreateEndpoint(mongo, TrainingPlanTestHelpers.CreateDenyingLinkAuthorizationService());

        await ep.HandleAsync(
            new LinkTrainingQuestionnaireRequest { PlanId = planId, QuestionnaireResponseId = null, Version = plan.Version },
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
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = CreateEndpoint(
            mongo,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
                canViewNutritionPlans: true, canViewTrainingPlans: false));

        await ep.HandleAsync(
            new LinkTrainingQuestionnaireRequest { PlanId = planId, QuestionnaireResponseId = null, Version = plan.Version },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        await mongo.TrainingPlans.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.TrainingPlan>>(),
            Arg.Any<Application.Domain.Documents.TrainingPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }
}
