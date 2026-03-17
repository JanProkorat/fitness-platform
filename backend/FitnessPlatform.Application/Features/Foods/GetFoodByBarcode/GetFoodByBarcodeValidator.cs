using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Foods.GetFoodByBarcode;

/// <summary>
/// Validates the <see cref="GetFoodByBarcodeRequest"/>.
/// </summary>
public class GetFoodByBarcodeValidator : Validator<GetFoodByBarcodeRequest>
{
    /// <summary>
    /// Initializes validation rules for barcode lookup.
    /// </summary>
    public GetFoodByBarcodeValidator()
    {
        RuleFor(x => x.Barcode)
            .NotEmpty()
            .MaximumLength(50);
    }
}
