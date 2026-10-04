using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Foods.UpdateFoodTag;

/// <summary>
/// Validates the <see cref="UpdateFoodTagRequest"/>. Name uniqueness per owner is an
/// endpoint-level check — see <see cref="UpdateFoodTagEndpoint"/>.
/// </summary>
public class UpdateFoodTagValidator : Validator<UpdateFoodTagRequest>
{
    /// <summary>
    /// Initializes validation rules for food tag updates.
    /// </summary>
    public UpdateFoodTagValidator()
    {
        RuleFor(x => x.TagId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(50).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Description)
            .MaximumLength(500).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.ColorHex)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .Matches(@"^#[0-9a-fA-F]{6}\z").WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("ColorHex must be a 6-digit hex color, e.g. #3b82f6.");
    }
}
