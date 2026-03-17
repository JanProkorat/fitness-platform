using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.GetWeekPlan;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GetWeekPlanEndpoint"/>.
/// </summary>
public class GetWeekPlanEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ActivePlan_ReturnsCurrentWeek()
    {
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 2);
        plan.DatePublished = DateTime.UtcNow.Date;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = Factory.Create<GetWeekPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.PlanId.Should().Be(plan.ExternalId);
        ep.Response.WeekNumber.Should().Be(1);
        ep.Response.Days.Should().HaveCount(7);
    }

    [Fact]
    public async Task HandleAsync_NoPlan_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetWeekPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetWeekPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
