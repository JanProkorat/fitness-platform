using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Foods.ConfirmFoodImage;

/// <summary>
/// Validates the <see cref="ConfirmFoodImageRequest"/>.
/// </summary>
public class ConfirmFoodImageValidator : Validator<ConfirmFoodImageRequest>
{
    private static readonly HashSet<string> ValidSlots =
        new(StringComparer.OrdinalIgnoreCase) { "main", "gallery" };

    /// <summary>
    /// Initializes validation rules for the food image confirmation request.
    /// </summary>
    public ConfirmFoodImageValidator()
    {
        RuleFor(x => x.BlobUrl)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.Slot)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .Must(s => ValidSlots.Contains(s))
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Slot must be 'main' or 'gallery'.");
    }
}
