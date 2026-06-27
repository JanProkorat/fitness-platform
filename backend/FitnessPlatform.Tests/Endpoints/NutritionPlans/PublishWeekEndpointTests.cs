using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.PublishWeek;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="PublishWeekEndpoint"/>.
/// </summary>
public class PublishWeekEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    private PublishWeekEndpoint CreateEndpoint(IMongoContext mongo) =>
        Factory.Create<PublishWeekEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo,
            new MockDbBuilder().Build(),
            Substitute.For<INotificationService>(),
            Substitute.For<IRealtimeNotifier>());

    [Fact]
    public async Task HandleAsync_DraftWeek_PublishesSuccessfully()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Draft,
            weekCount: 2,
            version: 1);
        plan.StartDate = DateTime.UtcNow.Date;

        // Both weeks are Draft (default from CreatePlan)
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var ep = CreateEndpoint(mongo);

        var req = new PublishWeekRequest
        {
            PlanId = planId,
            WeekNumber = 1,
            Version = 1
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Should archive other active plans for the same client
        await mongo.NutritionPlans.Received().UpdateManyAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<UpdateDefinition<NutritionPlan>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        // Should replace the plan with Published week 1 and Active plan status
        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p =>
                p.Status == NutritionPlanStatus.Active &&
                p.Weeks.First(w => w.WeekNumber == 1).Status == WeekStatus.Published),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AlreadyPublished_ThrowsError()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active,
            weekCount: 2,
            version: 1);

        // Set week 1 to already Published
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = DateTime.UtcNow.AddDays(-1);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var ep = CreateEndpoint(mongo);

        var req = new PublishWeekRequest
        {
            PlanId = planId,
            WeekNumber = 1,
            Version = 1
        };

        var act = () => ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_VersionMismatch_Returns409WithProblemDetailsStatusCode()
    {
        // Verifies the version-mismatch path returns 409 via SendProblemAsync (RFC 7807
        // Problem Details), not the legacy raw anonymous-object SendAsync pattern.
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Draft,
            weekCount: 1,
            version: 5);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var ep = CreateEndpoint(mongo);

        // Send request with version 1, but plan is at version 5
        var req = new PublishWeekRequest
        {
            PlanId = planId,
            WeekNumber = 1,
            Version = 1
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Status 409 + ReplaceOneAsync never called confirms the version check fires
        // and uses SendProblemAsync (not a thrown exception which would surface differently).
        ep.HttpContext.Response.StatusCode.Should().Be(409);
        await mongo.NutritionPlans.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<NutritionPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var ep = CreateEndpoint(mongo);

        var req = new PublishWeekRequest
        {
            PlanId = Guid.NewGuid(),
            WeekNumber = 1,
            Version = 1
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
