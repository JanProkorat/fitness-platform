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

        // Mirrors the Identity password policy configured in Program.cs
        // (RequireDigit / RequireLowercase / RequireUppercase, RequiredLength = 8,
        // RequireNonAlphanumeric = false). Catching policy violations here means
        // FastEndpoints' automatic validation pipeline rejects a weak password with
        // a field-level message BEFORE HandleAsync ever calls
        // UserManager.ResetPasswordAsync — so a policy violation for a user holding
        // a valid, unexpired token never falls into the endpoint's generic
        // enumeration-safe failure message (see #692 / #656).
        RuleFor(x => x.NewPassword)
            .NotEmpty()
            .MinimumLength(8)
            .MaximumLength(100)
            .Matches("[A-Z]").WithMessage("Password must contain at least one uppercase letter.")
            .Matches("[a-z]").WithMessage("Password must contain at least one lowercase letter.")
            .Matches("[0-9]").WithMessage("Password must contain at least one digit.");

        RuleFor(x => x.ConfirmPassword)
            .NotEmpty()
            .Equal(x => x.NewPassword)
            .WithMessage("Passwords do not match.");
    }
}
