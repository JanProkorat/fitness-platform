using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Foods.GetFood;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Tests for <see cref="GetFoodEndpoint"/>.
/// </summary>
public class GetFoodEndpointTests
{
    [Fact]
    public async Task HandleAsync_FoodExists_ReturnsFoodSummary()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, name: "Banana");
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<GetFoodEndpoint>(mongo);

        await ep.HandleAsync(new GetFoodRequest { FoodId = foodId }, TestContext.Current.CancellationToken);

        ep.Response.Name.Should().Be("Banana");
        ep.Response.FoodId.Should().Be(foodId);
    }

    [Fact]
    public async Task HandleAsync_FoodNotFound_Returns404()
    {
        var mongo = FoodTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetFoodEndpoint>(mongo);

        await ep.HandleAsync(new GetFoodRequest { FoodId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_PrivateFood_OwnerCanRead()
    {
        var ownerId = Guid.NewGuid();
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(
            externalId: foodId,
            name: "Private Note",
            nutritionistId: ownerId,
            visibility: FoodVisibility.Private);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<GetFoodEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(ownerId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new GetFoodRequest { FoodId = foodId }, TestContext.Current.CancellationToken);

        ep.Response.Name.Should().Be("Private Note");
        ep.Response.IsOwnedByCurrentUser.Should().BeTrue();
        ep.Response.Visibility.Should().Be(FoodVisibility.Private);
    }

    [Fact]
    public async Task HandleAsync_PrivateFood_OtherNutritionistGets404()
    {
        var ownerId = Guid.NewGuid();
        var otherNutritionistId = Guid.NewGuid();
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(
            externalId: foodId,
            nutritionistId: ownerId,
            visibility: FoodVisibility.Private);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<GetFoodEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(otherNutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new GetFoodRequest { FoodId = foodId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_PrivateFood_ClientCanRead()
    {
        var ownerId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(
            externalId: foodId,
            name: "Plan Filler",
            nutritionistId: ownerId,
            visibility: FoodVisibility.Private);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<GetFoodEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(clientId, AppRoles.Client))),
            mongo);

        await ep.HandleAsync(new GetFoodRequest { FoodId = foodId }, TestContext.Current.CancellationToken);

        ep.Response.Name.Should().Be("Plan Filler");
        ep.Response.IsOwnedByCurrentUser.Should().BeFalse();
    }

    [Fact]
    public async Task HandleAsync_PublicFood_OtherNutritionistCanRead()
    {
        var ownerId = Guid.NewGuid();
        var otherNutritionistId = Guid.NewGuid();
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(
            externalId: foodId,
            name: "Shared Food",
            nutritionistId: ownerId,
            visibility: FoodVisibility.Public);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<GetFoodEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(otherNutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new GetFoodRequest { FoodId = foodId }, TestContext.Current.CancellationToken);

        ep.Response.Name.Should().Be("Shared Food");
        ep.Response.IsOwnedByCurrentUser.Should().BeFalse();
        ep.Response.Visibility.Should().Be(FoodVisibility.Public);
    }
}
