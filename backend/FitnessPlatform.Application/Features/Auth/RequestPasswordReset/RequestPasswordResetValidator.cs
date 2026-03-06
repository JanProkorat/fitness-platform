using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Auth.RequestPasswordReset;

/// <summary>
/// Validates the <see cref="RequestPasswordResetRequest"/>.
/// </summary>
public class RequestPasswordResetValidator : Validator<RequestPasswordResetRequest>
{
    /// <summary>
    /// Initializes validation rules for password reset request.
    /// </summary>
    public RequestPasswordResetValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress();
    }
}
