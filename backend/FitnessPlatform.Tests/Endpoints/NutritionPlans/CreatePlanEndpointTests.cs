using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlans.CreatePlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="CreatePlanEndpoint"/>.
/// </summary>
public class CreatePlanEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesPlan()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, authHelper, db);

        var request = new CreatePlanRequest
        {
            ClientId = _clientId,
            Name = "Weight Loss Plan",
            WeekCount = 2
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.NutritionPlans.Received(1).InsertOneAsync(
            Arg.Is<NutritionPlan>(p =>
                p.Name == "Weight Loss Plan" &&
                p.ClientId == _clientId &&
                p.NutritionistId == _nutritionistId &&
                p.Status == NutritionPlanStatus.Draft &&
                p.Weeks.Count == 2 &&
                p.Weeks[0].Days.Count == 7),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoLink_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: false);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, authHelper, db);

        await ep.HandleAsync(
            new CreatePlanRequest { ClientId = _clientId, Name = "Plan" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CreatePlanEndpoint>(mongo, authHelper, db);

        await ep.HandleAsync(
            new CreatePlanRequest { ClientId = _clientId, Name = "Plan" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    private static NutritionAuthHelper CreateAuthHelper(bool hasLink)
    {
        // Create db substitute first, then partial substitute — avoids NSubstitute nesting pitfall
        var db = Substitute.For<IApplicationDbContext>();
        var helper = Substitute.ForPartsOf<NutritionAuthHelper>(db);
        helper.HasActiveLinkAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(hasLink);
        return helper;
    }
}
