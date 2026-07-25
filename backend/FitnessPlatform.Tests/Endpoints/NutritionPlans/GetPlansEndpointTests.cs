using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlans;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="GetPlansEndpoint"/>.
/// </summary>
public class GetPlansEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_HasPlans_ReturnsList()
    {
        var plan1 = PlanTestHelpers.CreatePlan(nutritionistId: _nutritionistId, name: "Plan A");
        var plan2 = PlanTestHelpers.CreatePlan(nutritionistId: _nutritionistId, name: "Plan B");
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan1, plan2]);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetPlansEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, db);

        await ep.HandleAsync(new GetPlansRequest(), TestContext.Current.CancellationToken);

        ep.Response.Plans.Should().HaveCount(2);
        ep.Response.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task HandleAsync_NoPlans_ReturnsEmpty()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetPlansEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, db);

        await ep.HandleAsync(new GetPlansRequest(), TestContext.Current.CancellationToken);

        ep.Response.Plans.Should().BeEmpty();
    }
}
