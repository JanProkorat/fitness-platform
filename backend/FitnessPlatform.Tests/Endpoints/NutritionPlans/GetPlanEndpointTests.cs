using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlan;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="GetPlanEndpoint"/>.
/// </summary>
public class GetPlanEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_PlanExists_ReturnsDetail()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            name: "My Plan");
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = Factory.Create<GetPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new GetPlanRequest { PlanId = planId }, TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.Name.Should().Be("My Plan");
    }

    [Fact]
    public async Task HandleAsync_PlanNotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(
            new GetPlanRequest { PlanId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
