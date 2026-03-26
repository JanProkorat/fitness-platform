using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="GetTrainingPlanEndpoint"/>.
/// </summary>
public class GetTrainingPlanEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_OwnPlan_Returns200()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<GetTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo);

        await ep.HandleAsync(new GetTrainingPlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task HandleAsync_NotOwner_Returns404()
    {
        var plan = TrainingPlanTestHelpers.CreatePlan(trainerId: Guid.NewGuid());
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<GetTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo);

        await ep.HandleAsync(new GetTrainingPlanRequest { PlanId = plan.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
