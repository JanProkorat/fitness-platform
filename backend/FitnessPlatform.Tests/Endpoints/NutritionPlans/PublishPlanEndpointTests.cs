using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlans.PublishPlan;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="PublishPlanEndpoint"/>.
/// </summary>
public class PublishPlanEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_DraftPlan_Publishes()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Draft);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = Factory.Create<PublishPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new PublishPlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        // Should archive existing active plans first
        await mongo.NutritionPlans.Received().UpdateManyAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<UpdateDefinition<NutritionPlan>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        // Should update the plan to Active
        await mongo.NutritionPlans.Received().UpdateOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<UpdateDefinition<NutritionPlan>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AlreadyActive_ThrowsError()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = Factory.Create<PublishPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        var act = () => ep.HandleAsync(
            new PublishPlanRequest { PlanId = planId },
            TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = Factory.Create<PublishPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(
            new PublishPlanRequest { PlanId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
