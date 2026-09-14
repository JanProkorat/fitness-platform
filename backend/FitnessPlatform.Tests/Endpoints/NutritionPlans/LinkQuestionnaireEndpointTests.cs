using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.NutritionPlans.LinkQuestionnaire;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="LinkQuestionnaireEndpoint"/>.
/// </summary>
public class LinkQuestionnaireEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    private LinkQuestionnaireEndpoint CreateEndpoint(
        IMongoContext mongo, IClientLinkAuthorizationService? linkAuthorizationService = null) =>
        Factory.Create<LinkQuestionnaireEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo,
            new MockDbBuilder().Build(),
            new PlanConcurrencyGuard(),
            linkAuthorizationService ?? EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

    [Fact]
    public async Task HandleAsync_Unlink_Returns200()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        plan.QuestionnaireResponseId = Guid.NewGuid();
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(
            new LinkNutritionQuestionnaireRequest { PlanId = planId, QuestionnaireResponseId = null, Version = plan.Version },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.NutritionPlan>>(),
            Arg.Is<Application.Domain.Documents.NutritionPlan>(p => p.QuestionnaireResponseId == null),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_PlanNotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(
            new LinkNutritionQuestionnaireRequest { PlanId = Guid.NewGuid(), Version = 1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// Deny-path test for the link-authorization guard itself (not authorship). The plan is
    /// owned by the caller, but the caller's link to the plan's client no longer grants
    /// nutrition access — this must still 404. If <see cref="IClientLinkAuthorizationService"/>
    /// were removed from this guard, this test would regress to 200.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NotLinkedToClient_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = CreateEndpoint(mongo, PlanTestHelpers.CreateDenyingLinkAuthorizationService());

        await ep.HandleAsync(
            new LinkNutritionQuestionnaireRequest { PlanId = planId, QuestionnaireResponseId = null, Version = plan.Version },
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
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = CreateEndpoint(
            mongo,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
                canViewNutritionPlans: false, canViewTrainingPlans: true));

        await ep.HandleAsync(
            new LinkNutritionQuestionnaireRequest { PlanId = planId, QuestionnaireResponseId = null, Version = plan.Version },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        await mongo.NutritionPlans.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.NutritionPlan>>(),
            Arg.Any<Application.Domain.Documents.NutritionPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }
}
