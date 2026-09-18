using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTags.CreateClientTag;

/// <summary>
/// Validates the <see cref="CreateClientTagRequest"/>. Name uniqueness per owner is an
/// endpoint-level check — validators are constructed without DI and cannot query the
/// DbContext — see <see cref="CreateClientTagEndpoint"/>.
/// </summary>
public class CreateClientTagValidator : Validator<CreateClientTagRequest>
{
    /// <summary>
    /// Initializes validation rules for client tag creation.
    /// </summary>
    public CreateClientTagValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(50).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Description)
            .MaximumLength(500).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.ColorHex)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .Matches("^#[0-9a-fA-F]{6}$").WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("ColorHex must be a 6-digit hex color, e.g. #3b82f6.");
    }
}
