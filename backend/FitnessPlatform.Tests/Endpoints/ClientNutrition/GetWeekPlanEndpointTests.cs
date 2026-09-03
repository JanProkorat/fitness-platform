using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.GetWeekPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GetWeekPlanEndpoint"/>.
/// </summary>
public class GetWeekPlanEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    [Fact]
    public async Task HandleAsync_ActivePlan_ReturnsCurrentWeek()
    {
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 2);
        plan.DatePublished = DateTime.UtcNow.Date;
        foreach (var w in plan.Weeks) w.Status = WeekStatus.Published;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var db = CreateMockDb();

        var ep = Factory.Create<GetWeekPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, TimeProvider.System);

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

        var db = CreateMockDb();

        var ep = Factory.Create<GetWeekPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var db = CreateMockDb();

        var ep = Factory.Create<GetWeekPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            mongo, db, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
