using FastEndpoints;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Application.Features.Foods.GetFoodByBarcode;

/// <summary>
/// Looks up a food by barcode. Cache-first: checks MongoDB, then Open Food Facts.
/// </summary>
/// <param name="externalService">External food data provider with caching.</param>
public class GetFoodByBarcodeEndpoint(
    IFoodExternalService externalService) : Endpoint<GetFoodByBarcodeRequest, FoodSummary>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/foods/barcode/{Barcode}");
        Summary(s =>
        {
            s.Summary = "Get food by barcode";
            s.Description = "Looks up a food by EAN/UPC barcode. Checks local cache first, then Open Food Facts.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetFoodByBarcodeRequest req, CancellationToken ct)
    {
        var food = await externalService.SearchByBarcodeAsync(req.Barcode, ct);

        if (food is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault()?.Split(',').FirstOrDefault()?.Split('-').FirstOrDefault();
        await Send.OkAsync(FoodSummary.FromDocument(food, language), ct);
    }
}
