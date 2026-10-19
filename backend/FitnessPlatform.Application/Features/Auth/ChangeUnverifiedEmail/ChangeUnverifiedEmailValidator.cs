using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Auth.ChangeUnverifiedEmail;

/// <summary>
/// Validates the <see cref="ChangeUnverifiedEmailRequest"/>.
/// </summary>
public class ChangeUnverifiedEmailValidator : Validator<ChangeUnverifiedEmailRequest>
{
    /// <summary>
    /// Initializes validation rules for changing an unverified email address.
    /// </summary>
    public ChangeUnverifiedEmailValidator()
    {
        RuleFor(x => x.NewEmail)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(100);
    }
}
