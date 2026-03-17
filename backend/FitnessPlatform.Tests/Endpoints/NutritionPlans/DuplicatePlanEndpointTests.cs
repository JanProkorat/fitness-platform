using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlans.DuplicatePlan;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="DuplicatePlanEndpoint"/>.
/// </summary>
public class DuplicatePlanEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidPlan_CreatesCopy()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            name: "Original",
            status: NutritionPlanStatus.Active);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = Factory.Create<DuplicatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(
            new DuplicatePlanRequest { PlanId = planId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.NutritionPlans.Received(1).InsertOneAsync(
            Arg.Is<NutritionPlan>(p =>
                p.Name == "Original (Copy)" &&
                p.Status == NutritionPlanStatus.Draft &&
                p.Version == 1 &&
                p.ExternalId != planId),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_CustomName_UsesProvidedName()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = Factory.Create<DuplicatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(
            new DuplicatePlanRequest { PlanId = planId, Name = "My Copy" },
            TestContext.Current.CancellationToken);

        await mongo.NutritionPlans.Received(1).InsertOneAsync(
            Arg.Is<NutritionPlan>(p => p.Name == "My Copy"),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = Factory.Create<DuplicatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(
            new DuplicatePlanRequest { PlanId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
