using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Foods.CreateFoodTag;

/// <summary>
/// Validates the <see cref="CreateFoodTagRequest"/>. Name uniqueness per owner is an
/// endpoint-level check — validators are constructed without DI and cannot query MongoDB — see
/// <see cref="CreateFoodTagEndpoint"/>.
/// </summary>
public class CreateFoodTagValidator : Validator<CreateFoodTagRequest>
{
    /// <summary>
    /// Initializes validation rules for food tag creation.
    /// </summary>
    public CreateFoodTagValidator()
    {
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
