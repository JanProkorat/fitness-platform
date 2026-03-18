using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Foods.GetFoodByBarcode;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Tests for <see cref="GetFoodByBarcodeEndpoint"/>.
/// </summary>
public class GetFoodByBarcodeEndpointTests
{
    [Fact]
    public async Task HandleAsync_BarcodeFound_ReturnsFoodSummary()
    {
        var food = FoodTestHelpers.CreateFood(name: "Nutella", barcode: "3017620422003");
        var externalService = Substitute.For<IFoodExternalService>();
        externalService.SearchByBarcodeAsync("3017620422003", Arg.Any<CancellationToken>())
            .Returns(food);

        var ep = Factory.Create<GetFoodByBarcodeEndpoint>(externalService);

        await ep.HandleAsync(new GetFoodByBarcodeRequest { Barcode = "3017620422003" }, TestContext.Current.CancellationToken);

        ep.Response.Name.Should().Be("Nutella");
        ep.Response.Barcode.Should().Be("3017620422003");
    }

    [Fact]
    public async Task HandleAsync_BarcodeNotFound_Returns404()
    {
        var externalService = Substitute.For<IFoodExternalService>();
        externalService.SearchByBarcodeAsync("0000000000", Arg.Any<CancellationToken>())
            .Returns((Food?)null);

        var ep = Factory.Create<GetFoodByBarcodeEndpoint>(externalService);

        await ep.HandleAsync(new GetFoodByBarcodeRequest { Barcode = "0000000000" }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_WithAcceptLanguageCzech_ReturnsCzechName()
    {
        var food = FoodTestHelpers.CreateFood(name: "Nutella", barcode: "3017620422003");
        food.LocalizedNames = new LocalizedNames
        {
            En = "Nutella",
            Cs = "Nutella čokoládová pomazánka",
            De = "Nutella Schokoladenaufstrich"
        };
        var externalService = Substitute.For<IFoodExternalService>();
        externalService.SearchByBarcodeAsync("3017620422003", Arg.Any<CancellationToken>())
            .Returns(food);

        var ep = Factory.Create<GetFoodByBarcodeEndpoint>(externalService);
        ep.HttpContext.Request.Headers.AcceptLanguage = "cs";

        await ep.HandleAsync(new GetFoodByBarcodeRequest { Barcode = "3017620422003" }, TestContext.Current.CancellationToken);

        ep.Response.Name.Should().Be("Nutella čokoládová pomazánka");
    }

    [Fact]
    public async Task HandleAsync_WithNoLocalizedNames_ReturnsFoodName()
    {
        var food = FoodTestHelpers.CreateFood(name: "Custom Food", barcode: "999");
        // No LocalizedNames set
        var externalService = Substitute.For<IFoodExternalService>();
        externalService.SearchByBarcodeAsync("999", Arg.Any<CancellationToken>())
            .Returns(food);

        var ep = Factory.Create<GetFoodByBarcodeEndpoint>(externalService);
        ep.HttpContext.Request.Headers.AcceptLanguage = "cs";

        await ep.HandleAsync(new GetFoodByBarcodeRequest { Barcode = "999" }, TestContext.Current.CancellationToken);

        ep.Response.Name.Should().Be("Custom Food");
    }
}
