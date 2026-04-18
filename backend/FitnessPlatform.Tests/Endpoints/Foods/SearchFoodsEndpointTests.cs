using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Foods.SearchFoods;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Tests for <see cref="SearchFoodsEndpoint"/>.
/// </summary>
public class SearchFoodsEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    private SearchFoodsEndpoint CreateEndpoint(FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext mongo)
        => Factory.Create<SearchFoodsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

    [Fact]
    public async Task HandleAsync_LocalResults_ReturnsFoods()
    {
        var food = FoodTestHelpers.CreateFood(name: "Chicken Breast");
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(new SearchFoodsRequest { Query = "chicken" }, TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(1);
        ep.Response.Foods[0].Name.Should().Be("Chicken Breast");
    }

    [Fact]
    public async Task HandleAsync_NoLocalResults_ReturnsEmpty()
    {
        var mongo = FoodTestHelpers.CreateMockMongo(); // empty

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(new SearchFoodsRequest { Query = "quinoa", PageSize = 20 }, TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_NoQuery_ReturnsAll()
    {
        var food1 = FoodTestHelpers.CreateFood(name: "Apple");
        var food2 = FoodTestHelpers.CreateFood(name: "Banana");
        var mongo = FoodTestHelpers.CreateMockMongo(food1, food2);

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(new SearchFoodsRequest(), TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(2);
    }

    [Fact]
    public async Task HandleAsync_WithAcceptLanguageCzech_ReturnsCzechName()
    {
        var food = FoodTestHelpers.CreateFood(name: "Chicken Breast");
        food.LocalizedNames = new LocalizedNames
        {
            En = "Chicken Breast",
            Cs = "Kuřecí prsa",
        };
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = CreateEndpoint(mongo);
        ep.HttpContext.Request.Headers.AcceptLanguage = "cs";

        await ep.HandleAsync(new SearchFoodsRequest { Query = "chicken" }, TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(1);
        ep.Response.Foods[0].Name.Should().Be("Kuřecí prsa");
    }

    [Fact]
    public async Task HandleAsync_MissingUserIdClaim_Returns401()
    {
        var food = FoodTestHelpers.CreateFood(name: "Anything");
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<SearchFoodsEndpoint>(mongo);

        await ep.HandleAsync(new SearchFoodsRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_AuthenticatedOwner_IsOwnedFlagIsTrue()
    {
        var ownerId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(
            name: "My Private Food",
            nutritionistId: ownerId,
            visibility: FoodVisibility.Private);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<SearchFoodsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(ownerId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new SearchFoodsRequest(), TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(1);
        ep.Response.Foods[0].IsOwnedByCurrentUser.Should().BeTrue();
        ep.Response.Foods[0].Visibility.Should().Be(FoodVisibility.Private);
    }

    [Fact]
    public async Task HandleAsync_AuthenticatedNonOwner_IsOwnedFlagIsFalse()
    {
        var ownerId = Guid.NewGuid();
        var otherNutritionistId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(
            name: "Public Food",
            nutritionistId: ownerId,
            visibility: FoodVisibility.Public);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<SearchFoodsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(otherNutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new SearchFoodsRequest(), TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(1);
        ep.Response.Foods[0].IsOwnedByCurrentUser.Should().BeFalse();
    }
}
