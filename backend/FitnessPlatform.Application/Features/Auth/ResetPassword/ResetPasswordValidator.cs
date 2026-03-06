using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Auth.ResetPassword;

/// <summary>
/// Validates the <see cref="ResetPasswordRequest"/>.
/// </summary>
public class ResetPasswordValidator : Validator<ResetPasswordRequest>
{
    /// <summary>
    /// Initializes validation rules for password reset.
    /// </summary>
    public ResetPasswordValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty();

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress();

        RuleFor(x => x.NewPassword)
            .NotEmpty()
            .MinimumLength(8)
            .MaximumLength(100);

        RuleFor(x => x.ConfirmPassword)
            .NotEmpty()
            .Equal(x => x.NewPassword)
            .WithMessage("Passwords do not match.");
    }
}
