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
}
