using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Auth.Login;

/// <summary>
/// Validates the <see cref="LoginRequest"/>.
/// </summary>
public class LoginValidator : Validator<LoginRequest>
{
    /// <summary>
    /// Initializes validation rules for user login.
    /// </summary>
    public LoginValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress();

        RuleFor(x => x.Password)
            .NotEmpty();
    }
}
