using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Features.ClientNutrition.GetWeekPlan;
using FormUp.Application.Infrastructure.Data;
using FormUp.Tests.Builders;
using FormUp.Tests.Endpoints.NutritionPlans;

namespace FormUp.Tests.Endpoints.ClientNutrition;

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
        plan.StartDate = DateTime.UtcNow.Date;
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

}
