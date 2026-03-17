namespace FitnessPlatform.Application.Features.Foods.GetFoodByBarcode;

/// <summary>
/// Request model for looking up a food by barcode.
/// </summary>
public class GetFoodByBarcodeRequest
{
    /// <summary>
    /// EAN/UPC barcode string.
    /// </summary>
    public string Barcode { get; set; } = string.Empty;
}
