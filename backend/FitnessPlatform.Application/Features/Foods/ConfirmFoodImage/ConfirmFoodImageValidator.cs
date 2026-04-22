using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Foods.ConfirmFoodImage;

/// <summary>
/// Validates the <see cref="ConfirmFoodImageRequest"/>.
/// </summary>
public class ConfirmFoodImageValidator : Validator<ConfirmFoodImageRequest>
{
    /// <summary>
    /// Initializes validation rules for the food image confirmation request.
    /// </summary>
    public ConfirmFoodImageValidator()
    {
        RuleFor(x => x.BlobUrl)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);
    }
}
