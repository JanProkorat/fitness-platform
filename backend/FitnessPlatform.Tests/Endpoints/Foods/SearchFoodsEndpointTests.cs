using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Foods.SearchFoods;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Tests for <see cref="SearchFoodsEndpoint"/>.
/// </summary>
public class SearchFoodsEndpointTests
{
    [Fact]
    public async Task HandleAsync_LocalResults_ReturnsFoods()
    {
        var food = FoodTestHelpers.CreateFood(name: "Chicken Breast");
        var mongo = FoodTestHelpers.CreateMockMongo(food);
        var externalService = Substitute.For<IFoodExternalService>();

        var ep = Factory.Create<SearchFoodsEndpoint>(mongo, externalService);

        await ep.HandleAsync(new SearchFoodsRequest { Query = "chicken" }, TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(1);
        ep.Response.Foods[0].Name.Should().Be("Chicken Breast");
    }

    [Fact]
    public async Task HandleAsync_NoLocalResults_SupplementsFromExternal()
    {
        var mongo = FoodTestHelpers.CreateMockMongo(); // empty
        var externalService = Substitute.For<IFoodExternalService>();
        externalService.SearchByNameAsync("quinoa", 20, Arg.Any<CancellationToken>())
            .Returns([FoodTestHelpers.CreateFood(name: "Quinoa OFF", barcode: "123")]);

        var ep = Factory.Create<SearchFoodsEndpoint>(mongo, externalService);

        await ep.HandleAsync(new SearchFoodsRequest { Query = "quinoa", PageSize = 20 }, TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(1);
        ep.Response.Foods[0].Name.Should().Be("Quinoa OFF");
    }

    [Fact]
    public async Task HandleAsync_NoQuery_ReturnsAll()
    {
        var food1 = FoodTestHelpers.CreateFood(name: "Apple");
        var food2 = FoodTestHelpers.CreateFood(name: "Banana");
        var mongo = FoodTestHelpers.CreateMockMongo(food1, food2);
        var externalService = Substitute.For<IFoodExternalService>();

        var ep = Factory.Create<SearchFoodsEndpoint>(mongo, externalService);

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
        var externalService = Substitute.For<IFoodExternalService>();

        var ep = Factory.Create<SearchFoodsEndpoint>(mongo, externalService);
        ep.HttpContext.Request.Headers.AcceptLanguage = "cs";

        await ep.HandleAsync(new SearchFoodsRequest { Query = "chicken" }, TestContext.Current.CancellationToken);

        ep.Response.Foods.Should().HaveCount(1);
        ep.Response.Foods[0].Name.Should().Be("Kuřecí prsa");
    }
}
