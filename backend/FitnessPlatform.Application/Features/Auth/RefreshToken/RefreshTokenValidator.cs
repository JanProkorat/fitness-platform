using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Auth.RefreshToken;

/// <summary>
/// Validates the <see cref="RefreshTokenRequest"/>.
/// </summary>
public class RefreshTokenValidator : Validator<RefreshTokenRequest>
{
    /// <summary>
    /// Initializes validation rules for token refresh.
    /// </summary>
    public RefreshTokenValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty();
    }
}
