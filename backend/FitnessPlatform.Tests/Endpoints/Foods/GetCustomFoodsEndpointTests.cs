using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Foods.GetCustomFoods;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Tests for <see cref="GetCustomFoodsEndpoint"/>.
/// </summary>
public class GetCustomFoodsEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_HasCustomFoods_ReturnsList()
    {
        var food1 = FoodTestHelpers.CreateFood(name: "Custom A", nutritionistId: _nutritionistId);
        var food2 = FoodTestHelpers.CreateFood(name: "Custom B", nutritionistId: _nutritionistId);
        var mongo = FoodTestHelpers.CreateMockMongo(food1, food2);

        var ep = Factory.Create<GetCustomFoodsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new GetCustomFoodsRequest(), TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(2);
        ep.Response.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task HandleAsync_NoCustomFoods_ReturnsEmpty()
    {
        var mongo = FoodTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetCustomFoodsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new GetCustomFoodsRequest(), TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().BeEmpty();
        ep.Response.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = FoodTestHelpers.CreateMockMongo();
        var ep = Factory.Create<GetCustomFoodsEndpoint>(mongo);

        await ep.HandleAsync(new GetCustomFoodsRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
